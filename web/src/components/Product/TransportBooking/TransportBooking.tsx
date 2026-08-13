import React, { useState } from 'react';
import { ArrowRight, CalendarDays, Check, Ship, TrainFront, Users, X } from 'lucide-react';
import type { TransportBookingType } from '../../../services/productService';
import styles from './TransportBooking.module.css';

interface Props { productType: TransportBookingType; isZh: boolean }
type Fare = { value: string; zh: string; en: string; price: number };

const CONFIG: Record<Exclude<TransportBookingType, 'sealink'>, { titleZh: string; titleEn: string; origins: string[]; destinations: string[]; fares: Fare[] }> = {
  ghan: { titleZh: '规划您的传奇铁路之旅', titleEn: 'Plan your legendary rail journey', origins: ['Adelaide', 'Alice Springs', 'Darwin'], destinations: ['Darwin', 'Alice Springs', 'Adelaide'], fares: [
    { value: 'gold-twin', zh: 'Gold Twin 双人金品舱', en: 'Gold Twin', price: 2490 }, { value: 'gold-premium', zh: 'Gold Premium 豪华金品舱', en: 'Gold Premium', price: 2990 }, { value: 'platinum', zh: 'Platinum 白金舱', en: 'Platinum', price: 4590 },
  ] },
  'indian-pacific': { titleZh: '规划您的横贯澳洲铁路之旅', titleEn: 'Plan your transcontinental rail journey', origins: ['Adelaide', 'Perth', 'Sydney'], destinations: ['Perth', 'Sydney', 'Adelaide'], fares: [
    { value: 'gold-twin', zh: 'Gold Twin 双人金品舱', en: 'Gold Twin', price: 2690 }, { value: 'gold-premium', zh: 'Gold Premium 豪华金品舱', en: 'Gold Premium', price: 3590 }, { value: 'platinum', zh: 'Platinum 白金舱', en: 'Platinum', price: 5490 },
  ] },
  'great-southern': { titleZh: '规划您的南部海岸铁路之旅', titleEn: 'Plan your Great Southern journey', origins: ['Adelaide', 'Brisbane'], destinations: ['Brisbane', 'Adelaide'], fares: [
    { value: 'gold-twin', zh: 'Gold Twin 双人金品舱', en: 'Gold Twin', price: 2690 }, { value: 'gold-premium', zh: 'Gold Premium 豪华金品舱', en: 'Gold Premium', price: 3190 }, { value: 'platinum', zh: 'Platinum 白金舱', en: 'Platinum', price: 6190 },
  ] },
  overland: { titleZh: '规划您的 Adelaide–Melbourne 日间铁路之旅', titleEn: 'Plan your Adelaide–Melbourne day journey', origins: ['Adelaide', 'Melbourne'], destinations: ['Melbourne', 'Adelaide'], fares: [
    { value: 'red-standard', zh: 'Red Standard 标准座', en: 'Red Standard', price: 165 }, { value: 'red-premium', zh: 'Red Premium 优享座', en: 'Red Premium', price: 305 },
  ] },
};

export const TransportBooking: React.FC<Props> = ({ productType, isZh }) => {
  const isFerry = productType === 'sealink';
  const rail = !isFerry ? CONFIG[productType] : null;
  const origins = rail?.origins || ['Cape Jervis', 'Penneshaw'];
  const destinations = rail?.destinations || ['Penneshaw', 'Cape Jervis'];
  const fares = rail?.fares || [];
  const [origin, setOrigin] = useState(origins[0]); const [destination, setDestination] = useState(destinations[0]);
  const [travelDate, setTravelDate] = useState(''); const [returnDate, setReturnDate] = useState('');
  const [adults, setAdults] = useState(1); const [children, setChildren] = useState(0);
  const [fareValue, setFareValue] = useState(fares[0]?.value || ''); const [vehicle, setVehicle] = useState('none');
  const [preview, setPreview] = useState(false); const [contactOpen, setContactOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const selectedFare = fares.find((item) => item.value === fareValue) || fares[0];
  const total = isFerry ? adults * 136 + children * 51 + (vehicle === 'car' ? 198 : vehicle === 'motorbike' ? 76 : 0) : (selectedFare?.price || 0) * adults;
  const createPreview = () => { if (travelDate && (!isFerry || returnDate)) setPreview(true); };

  return <section className={`${styles.booking} ${isFerry ? styles.ferry : styles.rail}`} data-testid="transport-booking">
    <div className={styles.eyebrow}>{isFerry ? <Ship size={17} /> : <TrainFront size={17} />}{isZh ? '专属交通预订' : 'TRANSPORT ENQUIRY'}</div>
    <h2>{isZh ? (isFerry ? '规划您的袋鼠岛往返船票' : rail?.titleZh) : (isFerry ? 'Plan your Kangaroo Island crossing' : rail?.titleEn)}</h2>
    <p className={styles.intro}>{isZh ? '选择行程信息后生成预订预览，我们的旅行顾问将为您确认实时席位和最终价格。' : 'Choose your travel details to build an enquiry preview. Our specialist will confirm live availability and the final fare.'}</p>
    <div className={styles.route}><label><span>{isZh ? '起始点' : 'From'}</span><select value={origin} onChange={(e) => setOrigin(e.target.value)}>{origins.map(x => <option key={x}>{x}</option>)}</select></label><button className={styles.swap} type="button" onClick={() => { setOrigin(destination); setDestination(origin); }} aria-label={isZh ? '交换起终点' : 'Swap route'}><ArrowRight size={19} /></button><label><span>{isZh ? '目的地' : 'To'}</span><select value={destination} onChange={(e) => setDestination(e.target.value)}>{destinations.map(x => <option key={x}>{x}</option>)}</select></label></div>
    <div className={styles.formGrid}>
      <label><span><CalendarDays size={15}/>{isZh ? '出发日期' : 'Departure'}</span><input data-testid="transport-travel-date" type="date" min={today} value={travelDate} onChange={(e) => { setTravelDate(e.target.value); setPreview(false); }}/></label>
      {isFerry && <label><span><CalendarDays size={15}/>{isZh ? '返程日期' : 'Return'}</span><input data-testid="transport-return-date" type="date" min={travelDate || today} value={returnDate} onChange={(e) => { setReturnDate(e.target.value); setPreview(false); }}/></label>}
      <label><span><Users size={15}/>{isZh ? '成人' : 'Adults'}</span><select value={adults} onChange={(e) => setAdults(Number(e.target.value))}>{[1,2,3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></label>
      {isFerry && <label><span><Users size={15}/>{isZh ? '儿童（3–14岁）' : 'Children (3–14)'}</span><select value={children} onChange={(e)=>setChildren(Number(e.target.value))}>{[0,1,2,3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></label>}
      {!isFerry ? <label className={styles.wide}><span>{productType === 'overland' ? (isZh ? '座席等级' : 'Service') : (isZh ? '舱房等级' : 'Cabin class')}</span><select value={fareValue} onChange={(e)=>setFareValue(e.target.value)}>{fares.map(f=><option key={f.value} value={f.value}>{isZh?f.zh:f.en} · A${f.price.toLocaleString()}起/人</option>)}</select></label> : <label className={styles.wide}><span>{isZh?'车辆':'Vehicle'}</span><select value={vehicle} onChange={(e)=>setVehicle(e.target.value)}><option value="none">{isZh?'仅乘客，不携车':'Passengers only'}</option><option value="car">{isZh?'车辆 ≤ 5米':'Vehicle up to 5m'}</option><option value="motorbike">{isZh?'摩托车':'Motorbike'}</option></select></label>}
    </div>
    <div className={styles.estimate}><span>{isZh?'参考总价':'Estimated total'}</span><strong>A${total.toLocaleString()}</strong><small>{isZh?'动态价格，仅供预览；以客服确认的实时票价为准':'Indicative only; live fare confirmed by our specialist'}</small></div>
    <button data-testid="transport-preview-button" className={styles.previewButton} type="button" disabled={!travelDate || (isFerry&&!returnDate)} onClick={createPreview}>{isZh?'生成预订信息预览':'Create booking preview'}<ArrowRight size={18}/></button>
    {preview && <div className={styles.preview} data-testid="transport-booking-preview"><div className={styles.previewHeading}><span><Check size={18}/></span><div><small>{isZh?'行程预览':'TRIP PREVIEW'}</small><strong>{origin} {isFerry?'⇄':'→'} {destination}</strong></div></div><dl><div><dt>{isZh?'日期':'Date'}</dt><dd>{travelDate}{isFerry&&` — ${returnDate}`}</dd></div><div><dt>{isZh?'乘客':'Guests'}</dt><dd>{adults} {isZh?'位成人':'adult(s)'}{isFerry&&children>0?` · ${children} ${isZh?'位儿童':'child(ren)'}`:''}</dd></div><div><dt>{isZh?(isFerry?'车辆':productType==='overland'?'座席':'舱房'):(isFerry?'Vehicle':productType==='overland'?'Service':'Cabin')}</dt><dd>{isFerry?(vehicle==='none'?(isZh?'不携车':'No vehicle'):vehicle==='car'?(isZh?'车辆 ≤ 5米':'Vehicle up to 5m'):(isZh?'摩托车':'Motorbike')):(isZh?selectedFare.zh:selectedFare.en)}</dd></div><div className={styles.previewTotal}><dt>{isZh?'参考总价':'Estimated total'}</dt><dd>A${total.toLocaleString()}</dd></div></dl><button data-testid="transport-confirm-button" className={styles.confirmButton} type="button" onClick={()=>setContactOpen(true)}>{isZh?'确认预订信息':'Confirm enquiry'}</button></div>}
    {contactOpen&&<div className={styles.modalBackdrop} role="presentation" onMouseDown={()=>setContactOpen(false)}><div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="contact-title" onMouseDown={e=>e.stopPropagation()}><button className={styles.close} onClick={()=>setContactOpen(false)} aria-label={isZh?'关闭':'Close'}><X/></button><span className={styles.modalIcon}>{isFerry?<Ship/>:<TrainFront/>}</span><h3 id="contact-title">{isZh?'请联系客服预订':'Please contact us to book'}</h3><p>{isZh?'我们需要向运营方确认实时席位、票价与行程细节。请将预览信息提供给客服，我们会协助完成预订。':'We need to confirm live availability, fares and journey details with the operator.'}</p><a href="tel:+61406830901">+61 0406 830 901</a><a href="mailto:tonylai@enjoysau.com">tonylai@enjoysau.com</a><button type="button" onClick={()=>setContactOpen(false)}>{isZh?'我知道了':'Got it'}</button></div></div>}
  </section>;
};

export default TransportBooking;
