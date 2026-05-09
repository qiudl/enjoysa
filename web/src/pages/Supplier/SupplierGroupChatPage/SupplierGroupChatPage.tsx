/**
 * SupplierGroupChatPage — REQ-20260509-0037 dev-8 + dev-9.
 *
 * 3-column shell for the new workspace + channel + thread chat experience.
 *   left:   ChannelSidebar   — channel list, agent dot indicators
 *   center: ChannelMain      — channel header + message list + composer
 *   right:  ThreadPanel      — slides in when activeThreadParentId is set
 *                              (dev-9). Layout collapses back to 2-col when
 *                              the user closes the panel.
 *
 * Mounts <GroupChatProvider userType="supplier"> and bootstraps once on
 * mount so the workspace is ready before any child renders.
 *
 * Routes (declared in App.tsx):
 *   /supplier/chat            → opens default channel (#kefu-default)
 *   /supplier/chat/:slug      → opens the named channel after bootstrap
 *
 * The legacy /supplier/ai-chat page stays untouched until dev-10 lands the
 * create-channel modal + @mention dropdown — then we can swap or redirect.
 */
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { GroupChatProvider, useGroupChat } from '../../../contexts/GroupChatContext';
import { ChannelSidebar } from './ChannelSidebar';
import { ChannelMain } from './ChannelMain';
import { ThreadPanel } from './ThreadPanel';
import styles from './SupplierGroupChatPage.module.css';

interface SupplierGroupChatPageProps {
  /** Optional channel slug from the URL (`/supplier/chat/:slug`). */
  slugFromRoute?: string;
}

function SupplierGroupChatShell({ slugFromRoute }: { slugFromRoute?: string }) {
  const {
    bootstrap,
    channels,
    activeChannelId,
    activeThreadParentId,
    selectChannel,
    isBootstrapping,
    lastError,
  } = useGroupChat();

  // One-shot bootstrap. The provider's `bootstrap` is stable; calling twice is
  // harmless (the GET is idempotent) but the conditional keeps logs quiet.
  useEffect(() => {
    if (!channels.length && !isBootstrapping) {
      void bootstrap();
    }
  }, [bootstrap, channels.length, isBootstrapping]);

  // Resolve `:slug` → channel id once the workspace lands.
  useEffect(() => {
    if (!slugFromRoute || channels.length === 0) return;
    const target = channels.find(c => c.slug === slugFromRoute);
    if (target && target.id !== activeChannelId) {
      void selectChannel(target.id);
    }
  }, [slugFromRoute, channels, activeChannelId, selectChannel]);

  const threadOpen = activeThreadParentId !== null;

  return (
    <div className={styles.page} data-thread-open={threadOpen ? 'true' : 'false'}>
      <ChannelSidebar />
      <ChannelMain />
      {threadOpen && <ThreadPanel />}
      {lastError && (
        <div className={styles.errorToast} role="alert">
          {lastError}
        </div>
      )}
    </div>
  );
}

export default function SupplierGroupChatPage({ slugFromRoute: slugProp }: SupplierGroupChatPageProps) {
  // Allow both prop-based (App.tsx wrapper) and route-based mounting so the
  // page can be unit-tested without a Router around it.
  const params = useParams<{ slug?: string }>();
  const slugFromRoute = slugProp ?? params.slug;

  return (
    <GroupChatProvider userType="supplier">
      <SupplierGroupChatShell slugFromRoute={slugFromRoute} />
    </GroupChatProvider>
  );
}
