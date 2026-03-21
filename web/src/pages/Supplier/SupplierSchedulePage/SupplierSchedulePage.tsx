import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Pencil, Trash2, X, Plus, Layers } from 'lucide-react';
import { supplierProductService } from '../../../services/supplierProductService';
import type { ApiProduct, ApiProductSchedule, ApiProductPackage } from '../../../services/productService';
import styles from './SupplierSchedulePage.module.css';

export interface SupplierSchedulePageProps {
  productId?: string;
  onNavigate?: (path: string) => void;
}

// Helpers
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: { date: Date; current: boolean }[] = [];

  // Leading days from prev month
  const startWeekday = firstDay.getDay(); // 0=Sun
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, current: false });
  }

  // Current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), current: true });
  }

  // Trailing days
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), current: false });
  }

  return days;
}

type ModalMode = 'add' | 'edit' | 'batch' | null;

export const SupplierSchedulePage: React.FC<SupplierSchedulePageProps> = ({
  productId,
  onNavigate,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');

  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [schedules, setSchedules] = useState<ApiProductSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingSchedule, setEditingSchedule] = useState<ApiProductSchedule | null>(null);

  // Form state
  const [formDate, setFormDate] = useState('');
  const [formTimeSlot, setFormTimeSlot] = useState('');
  const [formTotalSlots, setFormTotalSlots] = useState('20');
  const [formPrice, setFormPrice] = useState('');
  const [formPackageId, setFormPackageId] = useState('0');

  // Batch form state
  const [batchStartDate, setBatchStartDate] = useState('');
  const [batchEndDate, setBatchEndDate] = useState('');
  const [batchPattern, setBatchPattern] = useState<'everyday' | 'weekdays' | 'weekends' | 'custom'>('everyday');
  const [batchCustomDays, setBatchCustomDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri

  const [saving, setSaving] = useState(false);

  const numProductId = productId ? Number(productId) : 0;

  const loadData = useCallback(async () => {
    if (!numProductId) return;
    setLoading(true);
    try {
      const [prod, sched] = await Promise.all([
        supplierProductService.getById(numProductId),
        supplierProductService.getSchedules(numProductId),
      ]);
      setProduct(prod);
      setSchedules(sched);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [numProductId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const packages: ApiProductPackage[] = product?.packages || [];

  // Schedules grouped by date string
  const scheduleDateSet = new Set(
    schedules.map((s) => s.date.split('T')[0]),
  );

  const selectedDateStr = formatDate(selectedDate);
  const daySchedules = schedules
    .filter((s) => s.date.split('T')[0] === selectedDateStr)
    .sort((a, b) => (a.time_slot || '').localeCompare(b.time_slot || ''));

  // Calendar
  const monthDays = getMonthDays(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString(
    isZh ? 'zh-CN' : 'en-US',
    { year: 'numeric', month: 'long' },
  );
  const weekDayKeys: string[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  const goPrevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const goNextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };
  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(new Date(today));
  };

  // Open modals
  const openAddModal = () => {
    setFormDate(selectedDateStr);
    setFormTimeSlot('09:00');
    setFormTotalSlots('20');
    setFormPrice('');
    setFormPackageId('0');
    setEditingSchedule(null);
    setModalMode('add');
  };

  const openEditModal = (s: ApiProductSchedule) => {
    setFormDate(s.date.split('T')[0]);
    setFormTimeSlot(s.time_slot || '');
    setFormTotalSlots(String(s.total_slots));
    setFormPrice(s.price ? String(s.price) : '');
    setFormPackageId(String(s.package_id || 0));
    setEditingSchedule(s);
    setModalMode('edit');
  };

  const openBatchModal = () => {
    setBatchStartDate(selectedDateStr);
    const endDate = new Date(selectedDate);
    endDate.setDate(endDate.getDate() + 6);
    setBatchEndDate(formatDate(endDate));
    setFormTimeSlot('09:00');
    setFormTotalSlots('20');
    setFormPrice('');
    setFormPackageId('0');
    setBatchPattern('everyday');
    setBatchCustomDays([1, 2, 3, 4, 5]);
    setModalMode('batch');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingSchedule(null);
  };

  // Save single schedule
  const handleSave = async () => {
    if (!numProductId) return;
    setSaving(true);
    try {
      const payload = {
        package_id: Number(formPackageId) || undefined,
        date: formDate,
        time_slot: formTimeSlot || undefined,
        total_slots: Number(formTotalSlots) || 20,
        price: formPrice ? Number(formPrice) : undefined,
      };

      if (modalMode === 'edit' && editingSchedule) {
        await supplierProductService.updateSchedule(numProductId, editingSchedule.id, payload);
      } else {
        await supplierProductService.createSchedule(numProductId, payload);
      }

      await loadData();
      closeModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  // Batch create
  const handleBatchCreate = async () => {
    if (!numProductId || !batchStartDate || !batchEndDate) return;
    setSaving(true);
    try {
      // Generate individual dates based on pattern
      const start = new Date(batchStartDate);
      const end = new Date(batchEndDate);
      const items: { package_id?: number; date: string; time_slot?: string; total_slots: number; price?: number | null }[] = [];

      for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
        const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon...
        let include = false;
        if (batchPattern === 'everyday') include = true;
        else if (batchPattern === 'weekdays') include = dayOfWeek >= 1 && dayOfWeek <= 5;
        else if (batchPattern === 'weekends') include = dayOfWeek === 0 || dayOfWeek === 6;
        else if (batchPattern === 'custom') include = batchCustomDays.includes(dayOfWeek);

        if (include) {
          items.push({
            package_id: Number(formPackageId) || undefined,
            date: formatDate(d),
            time_slot: formTimeSlot || undefined,
            total_slots: Number(formTotalSlots) || 20,
            price: formPrice ? Number(formPrice) : undefined,
          });
        }
      }

      if (items.length === 0) {
        alert(isZh ? '选定的日期范围内没有符合条件的日期' : 'No matching dates in the selected range');
        setSaving(false);
        return;
      }

      await supplierProductService.batchCreateSchedules(numProductId, items);
      await loadData();
      closeModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  // Delete schedule
  const handleDelete = async (s: ApiProductSchedule) => {
    if (!confirm(t('supplier.schedule.confirmDelete'))) return;
    try {
      await supplierProductService.deleteSchedule(numProductId, s.id);
      setSchedules((prev) => prev.filter((x) => x.id !== s.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  const getSlotLevel = (booked: number, total: number) => {
    const ratio = total > 0 ? booked / total : 0;
    if (ratio >= 0.8) return 'high';
    if (ratio >= 0.4) return 'medium';
    return 'low';
  };

  const getStatusClass = (status: string) => {
    if (status === 'full') return styles.statusFull;
    if (status === 'cancelled') return styles.statusCancelled;
    return styles.statusAvailable;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'full') return t('supplier.schedule.statusFull');
    if (status === 'cancelled') return t('supplier.schedule.statusCancelled');
    return t('supplier.schedule.statusAvailable');
  };

  const getPackageName = (pkgId: number) => {
    const pkg = packages.find((p) => p.id === pkgId);
    if (!pkg) return '';
    return isZh ? pkg.name_zh : pkg.name_en;
  };

  if (loading) {
    return (
      <div className={styles.loading}>{t('supplier.schedule.loading')}</div>
    );
  }

  return (
    <div className={styles.container}>
          {/* Page Header */}
          <div className={styles.pageHeader}>
            <div className={styles.headerLeft}>
              <button className={styles.backBtn} onClick={() => onNavigate?.('/supplier/products')}>
                ← {t('supplier.schedule.back')}
              </button>
              <div className={styles.headerInfo}>
                <h1>{t('supplier.schedule.title')}</h1>
                {product && (
                  <span className={styles.productName}>
                    {t('supplier.schedule.productLabel')}: {isZh ? product.name_zh : product.name_en}
                  </span>
                )}
              </div>
            </div>
            <div className={styles.headerActions}>
              <button className={styles.btnSecondary} onClick={openBatchModal}>
                <Layers size={15} />
                {t('supplier.schedule.batchAdd')}
              </button>
              <button className={styles.btnPrimary} onClick={openAddModal}>
                <Plus size={15} />
                {t('supplier.schedule.addSchedule')}
              </button>
            </div>
          </div>

          <div className={styles.layout}>
            {/* Calendar */}
            <div className={styles.calendarCard}>
              <div className={styles.calendarNav}>
                <button className={styles.navBtn} onClick={goPrevMonth}>
                  <ChevronLeft size={18} />
                </button>
                <h3>{monthLabel}</h3>
                <button className={styles.navBtn} onClick={goNextMonth}>
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className={styles.calendarGrid}>
                {weekDayKeys.map((key) => (
                  <div key={key} className={styles.dayHeader}>
                    {t(`supplier.schedule.${key}`)}
                  </div>
                ))}
                {monthDays.map(({ date, current }, i) => {
                  const dateStr = formatDate(date);
                  const isToday = isSameDay(date, today);
                  const isSelected = isSameDay(date, selectedDate);
                  const hasSchedule = scheduleDateSet.has(dateStr);
                  const classes = [
                    styles.dayCell,
                    !current ? styles.otherMonth : '',
                    isToday ? styles.today : '',
                    isSelected ? styles.selected : '',
                    hasSchedule ? styles.hasSchedule : '',
                  ].filter(Boolean).join(' ');

                  return (
                    <div key={i} className={classes} onClick={() => setSelectedDate(new Date(date))}>
                      {date.getDate()}
                    </div>
                  );
                })}
              </div>

              <button className={styles.todayBtn} onClick={goToday}>
                {t('supplier.schedule.today')}
              </button>
            </div>

            {/* Schedule List */}
            <div className={styles.schedulePanel}>
              <div className={styles.panelHeader}>
                <h3>
                  {selectedDate.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h3>
                <span className={styles.selectedDate}>
                  {daySchedules.length} {isZh ? '个排期' : 'schedule(s)'}
                </span>
              </div>

              {daySchedules.length > 0 ? (
                daySchedules.map((s) => {
                  const level = getSlotLevel(s.booked_slots, s.total_slots);
                  const pct = s.total_slots > 0 ? (s.booked_slots / s.total_slots) * 100 : 0;
                  return (
                    <div key={s.id} className={styles.scheduleItem}>
                      <div className={styles.scheduleTime}>{s.time_slot || '--:--'}</div>
                      <div className={styles.scheduleInfo}>
                        {s.package_id > 0 && (
                          <span className={styles.schedulePkg}>{getPackageName(s.package_id)}</span>
                        )}
                        <div className={styles.scheduleSlots}>
                          <div className={styles.slotBar}>
                            <div
                              className={`${styles.slotFill} ${styles[level]}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={styles.slotText}>
                            {s.booked_slots}/{s.total_slots}
                          </span>
                        </div>
                      </div>
                      {s.price != null && s.price > 0 && (
                        <span className={styles.schedulePrice}>A${s.price}</span>
                      )}
                      <span className={`${styles.statusBadge} ${getStatusClass(s.status)}`}>
                        {getStatusLabel(s.status)}
                      </span>
                      <div className={styles.scheduleActions}>
                        <button className={styles.iconBtn} onClick={() => openEditModal(s)} title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDelete(s)} title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>📅</span>
                  <p className={styles.emptyText}>{t('supplier.schedule.noSchedules')}</p>
                  <p className={styles.emptyHint}>{t('supplier.schedule.noSchedulesHint')}</p>
                </div>
              )}
            </div>
          </div>

      {/* Add/Edit Modal */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{modalMode === 'edit' ? t('supplier.schedule.editSchedule') : t('supplier.schedule.addSchedule')}</h3>
              <button className={styles.modalClose} onClick={closeModal}><X size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.schedule.date')}</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.schedule.timeSlot')}</label>
                  <input
                    type="time"
                    className={styles.input}
                    value={formTimeSlot}
                    onChange={(e) => setFormTimeSlot(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.schedule.totalSlots')}</label>
                  <input
                    type="number"
                    className={styles.input}
                    min="1"
                    value={formTotalSlots}
                    onChange={(e) => setFormTotalSlots(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.schedule.priceOverride')}</label>
                  <input
                    type="number"
                    className={styles.input}
                    min="0"
                    step="0.01"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="A$"
                  />
                </div>
              </div>
              {packages.length > 0 && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.schedule.package')}</label>
                  <select
                    className={styles.select}
                    value={formPackageId}
                    onChange={(e) => setFormPackageId(e.target.value)}
                  >
                    <option value="0">{t('supplier.schedule.selectPackage')}</option>
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {isZh ? pkg.name_zh : pkg.name_en} - A${pkg.price}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={closeModal}>
                {t('supplier.schedule.cancel')}
              </button>
              <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
                {saving ? '...' : t('supplier.schedule.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Modal */}
      {modalMode === 'batch' && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{t('supplier.schedule.batchTitle')}</h3>
              <button className={styles.modalClose} onClick={closeModal}><X size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.schedule.startDate')}</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={batchStartDate}
                    onChange={(e) => setBatchStartDate(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.schedule.endDate')}</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={batchEndDate}
                    onChange={(e) => setBatchEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>{t('supplier.schedule.repeatPattern')}</label>
                <div className={styles.patternBtns}>
                  {(['everyday', 'weekdays', 'weekends', 'custom'] as const).map((p) => (
                    <button
                      key={p}
                      className={`${styles.patternBtn} ${batchPattern === p ? styles.active : ''}`}
                      onClick={() => setBatchPattern(p)}
                    >
                      {t(`supplier.schedule.${p}`)}
                    </button>
                  ))}
                </div>
                {batchPattern === 'custom' && (
                  <div className={styles.weekdayBtns}>
                    {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                      <button
                        key={d}
                        className={`${styles.weekdayBtn} ${batchCustomDays.includes(d) ? styles.active : ''}`}
                        onClick={() =>
                          setBatchCustomDays((prev) =>
                            prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                          )
                        }
                      >
                        {t(`supplier.schedule.${weekDayKeys[d]}`)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.schedule.timeSlot')}</label>
                  <input
                    type="time"
                    className={styles.input}
                    value={formTimeSlot}
                    onChange={(e) => setFormTimeSlot(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.schedule.totalSlots')}</label>
                  <input
                    type="number"
                    className={styles.input}
                    min="1"
                    value={formTotalSlots}
                    onChange={(e) => setFormTotalSlots(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('supplier.schedule.priceOverride')}</label>
                  <input
                    type="number"
                    className={styles.input}
                    min="0"
                    step="0.01"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="A$"
                  />
                </div>
                {packages.length > 0 && (
                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('supplier.schedule.package')}</label>
                    <select
                      className={styles.select}
                      value={formPackageId}
                      onChange={(e) => setFormPackageId(e.target.value)}
                    >
                      <option value="0">{t('supplier.schedule.selectPackage')}</option>
                      {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {isZh ? pkg.name_zh : pkg.name_en} - A${pkg.price}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={closeModal}>
                {t('supplier.schedule.cancel')}
              </button>
              <button className={styles.btnPrimary} onClick={handleBatchCreate} disabled={saving}>
                {saving ? t('supplier.schedule.batchCreating') : t('supplier.schedule.batchCreate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierSchedulePage;
