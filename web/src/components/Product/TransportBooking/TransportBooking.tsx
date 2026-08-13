import React, { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Check, Ship, TrainFront, Users, X } from 'lucide-react';
import styles from './TransportBooking.module.css';

type TransportType = 'ghan' | 'sealink';

interface TransportBookingProps {
  productType: TransportType;
  isZh: boolean;
}

const GHAN_CABINS = [
  { value: 'gold-twin', zh: 'Gold Twin 双人金品舱', en: 'Gold Twin', price: 2490 },
  { value: 'gold-premium', zh: 'Gold Premium 豪华金品舱', en: 'Gold Premium', price: 2990 },
  { value: 'platinum', zh: 'Platinum 白金舱', en: 'Platinum', price: 4590 },
] as const;

export const TransportBooking: React.FC<TransportBookingProps> = ({ productType, isZh }) => {
  const isGhan = productType === 'ghan';
  const [origin, setOrigin] = useState(isGhan ? 'Adelaide' : 'Cape Jervis');
  const [destination, setDestination] = useState(isGhan ? 'Darwin' : 'Penneshaw');
  const [travelDate, setTravelDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [cabin, setCabin] = useState('gold-twin');
  const [vehicle, setVehicle] = useState('none');
  const [preview, setPreview] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const selectedCabin = GHAN_CABINS.find((item) => item.value === cabin) || GHAN_CABINS[0];
  const total = useMemo(() => {
    if (isGhan) return selectedCabin.price * adults;
    const passengerReturn = adults * 98 + children * 51;
    const vehicleReturn = vehicle === 'car' ? 198 : vehicle === 'motorbike' ? 76 : 0;
    return passengerReturn + vehicleReturn;
  }, [adults, children, isGhan, selectedCabin.price, vehicle]);

  const swapRoute = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const createPreview = () => {
    if (!travelDate || (!isGhan && !returnDate)) return;
    setPreview(true);
  };

  return (
    <section className={`${styles.booking} ${isGhan ? styles.rail : styles.ferry}`} data-testid="transport-booking">
      <div className={styles.eyebrow}>{isGhan ? <TrainFront size={17} /> : <Ship size={17} />}{isZh ? '专属交通预订' : 'TRANSPORT ENQUIRY'}</div>
      <h2>{isZh ? (isGhan ? '规划您的传奇铁路之旅' : '规划您的袋鼠岛往返船票') : (isGhan ? 'Plan your legendary rail journey' : 'Plan your Kangaroo Island crossing')}</h2>
      <p className={styles.intro}>{isZh ? '选择行程信息后生成预订预览，我们的旅行顾问将为您确认实时席位和最终价格。' : 'Choose your travel details to build an enquiry preview. Our travel specialist will confirm live availability and the final fare.'}</p>

      <div className={styles.route}>
        <label><span>{isZh ? '起始点' : 'From'}</span><select value={origin} onChange={(e) => setOrigin(e.target.value)}>{(isGhan ? ['Adelaide', 'Alice Springs', 'Darwin'] : ['Cape Jervis', 'Penneshaw']).map((place) => <option key={place}>{place}</option>)}</select></label>
        <button className={styles.swap} type="button" onClick={swapRoute} aria-label={isZh ? '交换起终点' : 'Swap route'}><ArrowRight size={19} /></button>
        <label><span>{isZh ? '目的地' : 'To'}</span><select value={destination} onChange={(e) => setDestination(e.target.value)}>{(isGhan ? ['Darwin', 'Alice Springs', 'Adelaide'] : ['Penneshaw', 'Cape Jervis']).map((place) => <option key={place}>{place}</option>)}</select></label>
      </div>

      <div className={styles.formGrid}>
        <label><span><CalendarDays size={15} />{isZh ? '出发日期' : 'Departure'}</span><input data-testid="transport-travel-date" type="date" min={today} value={travelDate} onChange={(e) => { setTravelDate(e.target.value); setPreview(false); }} /></label>
        {!isGhan && <label><span><CalendarDays size={15} />{isZh ? '返程日期' : 'Return'}</span><input data-testid="transport-return-date" type="date" min={travelDate || today} value={returnDate} onChange={(e) => { setReturnDate(e.target.value); setPreview(false); }} /></label>}
        <label><span><Users size={15} />{isZh ? '成人' : 'Adults'}</span><select value={adults} onChange={(e) => setAdults(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        {!isGhan && <label><span><Users size={15} />{isZh ? '儿童（3–14岁）' : 'Children (3–14)'}</span><select value={children} onChange={(e) => setChildren(Number(e.target.value))}>{[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>}
        {isGhan ? (
          <label className={styles.wide}><span>{isZh ? '舱房等级' : 'Cabin class'}</span><select value={cabin} onChange={(e) => setCabin(e.target.value)}>{GHAN_CABINS.map((item) => <option key={item.value} value={item.value}>{isZh ? item.zh : item.en} · A${item.price.toLocaleString()}起/人</option>)}</select></label>
        ) : (
          <label className={styles.wide}><span>{isZh ? '车辆' : 'Vehicle'}</span><select value={vehicle} onChange={(e) => setVehicle(e.target.value)}><option value="none">{isZh ? '仅乘客，不携车' : 'Passengers only'}</option><option value="car">{isZh ? '车辆 ≤ 5米' : 'Vehicle up to 5m'}</option><option value="motorbike">{isZh ? '摩托车' : 'Motorbike'}</option></select></label>
        )}
      </div>

      <div className={styles.estimate}><span>{isZh ? '参考总价' : 'Estimated total'}</span><strong>A${total.toLocaleString()}</strong><small>{isZh ? '动态价格，仅供预览；以客服确认的实时票价为准' : 'Indicative only; live fare confirmed by our specialist'}</small></div>
      <button data-testid="transport-preview-button" className={styles.previewButton} type="button" disabled={!travelDate || (!isGhan && !returnDate)} onClick={createPreview}>{isZh ? '生成预订信息预览' : 'Create booking preview'}<ArrowRight size={18} /></button>

      {preview && (
        <div className={styles.preview} data-testid="transport-booking-preview">
          <div className={styles.previewHeading}><span><Check size={18} /></span><div><small>{isZh ? '行程预览' : 'TRIP PREVIEW'}</small><strong>{origin} {isGhan ? '→' : '⇄'} {destination}</strong></div></div>
          <dl>
            <div><dt>{isZh ? '日期' : 'Date'}</dt><dd>{travelDate}{!isGhan && ` — ${returnDate}`}</dd></div>
            <div><dt>{isZh ? '乘客' : 'Guests'}</dt><dd>{adults} {isZh ? '位成人' : 'adult(s)'}{!isGhan && children > 0 ? ` · ${children} ${isZh ? '位儿童' : 'child(ren)'}` : ''}</dd></div>
            <div><dt>{isZh ? (isGhan ? '舱房' : '车辆') : (isGhan ? 'Cabin' : 'Vehicle')}</dt><dd>{isGhan ? (isZh ? selectedCabin.zh : selectedCabin.en) : (vehicle === 'none' ? (isZh ? '不携车' : 'No vehicle') : vehicle === 'car' ? (isZh ? '车辆 ≤ 5米' : 'Vehicle up to 5m') : (isZh ? '摩托车' : 'Motorbike'))}</dd></div>
            <div className={styles.previewTotal}><dt>{isZh ? '参考总价' : 'Estimated total'}</dt><dd>A${total.toLocaleString()}</dd></div>
          </dl>
          <button data-testid="transport-confirm-button" className={styles.confirmButton} type="button" onClick={() => setContactOpen(true)}>{isZh ? '确认预订信息' : 'Confirm enquiry'}</button>
        </div>
      )}

      {contactOpen && <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setContactOpen(false)}><div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="contact-title" onMouseDown={(e) => e.stopPropagation()}><button className={styles.close} onClick={() => setContactOpen(false)} aria-label={isZh ? '关闭' : 'Close'}><X /></button><span className={styles.modalIcon}>{isGhan ? <TrainFront /> : <Ship />}</span><h3 id="contact-title">{isZh ? '请联系客服预订' : 'Please contact us to book'}</h3><p>{isZh ? '我们需要向运营方确认实时席位、票价与行程细节。请将预览信息提供给客服，我们会协助完成预订。' : 'We need to confirm live availability, fares and journey details with the operator. Share this preview with our team and we will assist with your booking.'}</p><a href="tel:+61406830901">+61 0406 830 901</a><a href="mailto:tonylai@enjoysau.com">tonylai@enjoysau.com</a><button type="button" onClick={() => setContactOpen(false)}>{isZh ? '我知道了' : 'Got it'}</button></div></div>}
    </section>
  );
};

export default TransportBooking;
