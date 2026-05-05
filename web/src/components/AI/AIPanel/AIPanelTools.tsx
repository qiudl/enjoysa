import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import styles from './AIPanel.module.css';
import clsx from 'clsx';

export interface ToolItem {
  id: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  name: string;
  description: string;
  /** Navigation path when clicked; undefined = inline in panel */
  path?: string;
  enabled: boolean;
  pinned?: boolean;
}

export interface ToolCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  tools: ToolItem[];
}

interface AIPanelToolsProps {
  categories: ToolCategory[];
  onToolClick?: (path?: string) => void;
}

export const AIPanelTools: React.FC<AIPanelToolsProps> = ({ categories, onToolClick }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [toolStates, setToolStates] = useState<Record<string, boolean>>(() => {
    const states: Record<string, boolean> = {};
    categories.forEach(cat => cat.tools.forEach(tool => { states[tool.id] = tool.enabled; }));
    return states;
  });

  const handleToggle = useCallback((toolId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setToolStates(prev => ({ ...prev, [toolId]: !prev[toolId] }));
  }, []);

  const filteredCategories = categories
    .map(cat => ({
      ...cat,
      tools: cat.tools.filter(tool =>
        !search || tool.name.toLowerCase().includes(search.toLowerCase()) ||
        tool.description.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter(cat => cat.tools.length > 0);

  return (
    <>
      <div className={styles.toolsToolbar}>
        <input
          className={styles.toolsSearch}
          placeholder={t('aiPanel.searchTools', '🔍 搜索工具...')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className={styles.toolsArea}>
        {filteredCategories.map(cat => (
          <div key={cat.id} className={styles.toolCategory}>
            <div className={styles.toolCategoryHeader}>
              <div
                className={styles.toolCategoryIcon}
                style={{ background: cat.iconBg, color: cat.iconColor }}
              >
                {cat.icon}
              </div>
              <span className={styles.toolCategoryName}>{cat.name}</span>
              <span className={styles.toolCategoryCount}>{cat.tools.length}</span>
            </div>
            <div className={styles.toolCards}>
              {cat.tools.map(tool => (
                <div
                  key={tool.id}
                  className={styles.toolCard}
                  onClick={() => toolStates[tool.id] && onToolClick?.(tool.path)}
                  style={{ opacity: toolStates[tool.id] ? 1 : 0.5 }}
                >
                  <div
                    className={styles.toolCardIcon}
                    style={{ background: tool.iconBg, color: tool.iconColor }}
                  >
                    {tool.icon}
                  </div>
                  <div className={styles.toolCardBody}>
                    <div className={styles.toolCardName}>{tool.name}</div>
                    <div className={styles.toolCardDesc}>{tool.description}</div>
                  </div>
                  <div className={styles.toolCardArrow}><ChevronRight size={14} /></div>
                  <button
                    className={clsx(styles.toolCardToggle, toolStates[tool.id] ? styles.on : styles.off)}
                    onClick={e => handleToggle(tool.id, e)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        {filteredCategories.length === 0 && (
          <div className={styles.feedEmpty}>{t('aiPanel.noToolsFound', '未找到工具')}</div>
        )}
      </div>
    </>
  );
};
