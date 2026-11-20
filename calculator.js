/* АВТОИМПОРТ43 — независимый справочный калькулятор; цены и ставки для 2026 года. */
(()=>{'use strict';
const q=id=>document.getElementById(id);
const T=window.AUTO43_TARIFFS;
if(!T){console.error('No tariffs');return;}
const state={currency:'JPY',age:'3to5',engine:'ice',importer:'private'};
const fallback={JPY:.519862,CNY:12.4009,KRW:.0620785,EUR:92.3322};
let rates={...fallback},rateDate='2026-11-13',source='example';
let latestMessage='';
const fmt=n=>Math.round(n).toLocaleString('ru-RU')+' ₽';
const valid=x=>Number.isFinite(x)&&x>0;
const cap=(max)=>max===null?Infinity:max;
const bracket=(rows,value)=>rows.find(row=>value<=cap(row[0])) || rows[rows.length-1];
const labelMap={lt3:'до 3 лет','3to5':'3–5 лет','5to7':'5–7 лет',gt7:'старше 7 лет',ice:'бензин/дизель',private:'физлицо для себя',business:'юрлицо или ИП'};
// Ориентировочные расходы до российского этапа доставки; указаны в валюте покупки.
const originLogistics={
 JPY:{amount:120000,title:'Фрахт до Владивостока (Япония)',note:'120 000 ¥ · зависит от порта отправления'},
 CNY:{amount:10000,title:'Логистика по Китаю',note:'10 000 ¥ · зависит от расстояния'},
 KRW:{amount:1600000,title:'Фрахт Пусан — Владивосток (Корея)',note:'1 600 000 ₩ · порт Пусан — Владивосток'}
};
function saved(k){try{return localStorage.getItem(k)}catch{return null}}
function save(k,v){try{localStorage.setItem(k,v)}catch{}}
function dateLabel(str){const d=new Date(str);return Number.isFinite(d.valueOf())?d.toLocaleDateString('ru-RU'):'неизвестно'}
function fxStatus(a,b){q('fx-status').textContent=a;q('fx-date').textContent=b}
function syncRates(){q('fx-rate').value=(rates[state.currency]||0).toFixed(6);q('fx-eur').value=(rates.EUR||0).toFixed(6);q('currency-unit').textContent=state.currency}
async function loadRates(){fxStatus('Обновляем курсы валют…','');
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  let r;try{r=await fetch('https://www.cbr-xml-daily.ru/daily_json.js',{signal:controller.signal,cache:'no-store'})}finally{clearTimeout(timer)}
  if(!r.ok)throw Error('HTTP '+r.status);
  const data=await r.json(),newRates={};
  for(const key of ['JPY','CNY','KRW','EUR']){const x=data.Valute?.[key];if(!x||!valid(x.Value)||!valid(x.Nominal))throw Error('missing '+key);newRates[key]=x.Value/x.Nominal}
  if(!Number.isFinite(Date.parse(data.Date)))throw Error('missing date');
  rates=newRates;rateDate=data.Date;source='live';save('auto43-rates',JSON.stringify({rates,date:rateDate}));
  fxStatus('Курсы обновлены','На '+dateLabel(rateDate));
 }catch(err){let cache;try{cache=JSON.parse(saved('auto43-rates')||'null')}catch{}
  if(cache?.rates&&['JPY','CNY','KRW','EUR'].every(k=>valid(cache.rates[k]))){rates=cache.rates;rateDate=cache.date;source='cache';fxStatus('Курс на последнюю доступную дату','На '+dateLabel(rateDate))}
  else{source='example';fxStatus('Уточните стоимость у специалиста','Свежий курс временно недоступен')}
 }
 syncRates();calc();
}
function addLine(title,value,detail=''){
 const row=document.createElement('div');row.className='calc-line';
 const left=document.createElement('div'),right=document.createElement('strong');left.textContent=title;
 if(detail){const small=document.createElement('small');small.textContent=detail;left.appendChild(small)}
 right.textContent=value;row.append(left,right);q('calc-lines').append(row)
}
function calcPersonalDuty(eurCar,cc,age,eurRate){
 if(age==='lt3'){const r=bracket(T.personal.lt3,eurCar);return {rub:Math.max(eurCar*r[1],cc*r[2])*eurRate,how:Math.round(r[1]*100)+'% стоимости, не менее '+r[2]+' €/см³'}}
 const rows=age==='3to5'?T.personal['3to5']:T.personal.gt5;
 const r=bracket(rows,cc);return {rub:cc*r[1]*eurRate,how:r[1]+' €/см³'};
}
function calcBusinessDuty(carRub,cc,age,eurRate){
 const r=bracket(T.business[age],cc);
 return {rub:Math.max(carRub*r[1]/100,cc*r[2]*eurRate),how:r[1]?r[1]+'% стоимости, не менее '+r[2]+' €/см³':r[2]+' €/см³'};
}
function calcUtil(cc,hp,age,who,year=2026){
 // Power bands in source tariff schedule use kilowatts; convert horsepower consistently.
 const kW=hp*.73549875;
 const rows=T.util[String(year)][who==='private'?'fiz':'yur'];
 const found=rows.find(r=>cc<=cap(r.ccMax)&&kW<=cap(r.kwMax));
 if(!found)return null;
 return Math.round(T.utilBase*found[age==='lt3'?'lt3':'gt3']);
}
function calcClearance(carRub){return bracket(T.clearance,carRub)[1]}
function compute(x){
 const {price,cc,hp,rate,eur}=x;
 if(![price,cc,hp,rate,eur].every(valid)||cc<600||cc>8000||hp<30||hp>1000)return null;
 const carRub=price*rate,carEur=carRub/eur;
 const isPrivate=state.importer==='private';
 const duty=isPrivate?calcPersonalDuty(carEur,cc,state.age,eur):calcBusinessDuty(carRub,cc,state.age,eur);
 const excise=isPrivate?0:hp*bracket(T.excise,hp)[1];
 const vat=isPrivate?0:(carRub+duty.rub+excise)*T.vat;
 const util=calcUtil(cc,hp,state.age,state.importer);
 const clearance=calcClearance(carRub);
 if(!valid(util))return null;
 // Комиссия банка: 2% стоимости покупки автомобиля только для Китая (CNY).
 const bankFee=state.currency==='CNY'?carRub*.02:0;
 const logistics=originLogistics[state.currency];
 const logisticsRub=logistics?logistics.amount*rate:0;
 const total=carRub+duty.rub+excise+vat+util+clearance+T.broker+bankFee+logisticsRub;
 return {carRub,duty,excise,vat,util,clearance,broker:T.broker,bankFee,logistics,logisticsRub,total};
}
const wa='https://wa.me/79536863030?text=';
const tg='https://t.me/AVTOIMPORT43';
const max='https://max.ru/u/f9LHodD0cOKZVopOfZkldEMChM41k0oIlU511gSp2eUVirTMNhv9UoTO-P0';
function updateMessages(msg){latestMessage=msg;q('calc-whatsapp').href=wa+encodeURIComponent(msg);q('calc-whatsapp-evgenia').href='https://wa.me/79097184000?text='+encodeURIComponent(msg);q('calc-telegram').href=tg;q('calc-max').href=max}
async function copyText(){if(!latestMessage)return false;try{await navigator.clipboard.writeText(latestMessage);return true}catch(e){
 try{const el=document.createElement('textarea');el.value=latestMessage;el.style.position='fixed';el.style.opacity='0';document.body.append(el);el.select();const ok=document.execCommand('copy');el.remove();return ok}catch{return false}
}}
for(const id of ['calc-telegram','calc-max'])q(id).addEventListener('click',()=>{
 copyText().then(ok=>{q('calc-messenger-hint').textContent=ok?'Расчёт скопирован. Вставьте его в чат.':'Напишите нам в чате — поможем с расчётом.'})
});
function calc(){
 const price=Number(q('car-price').value),rate=Number(q('fx-rate').value),eur=Number(q('fx-eur').value),cc=Number(q('car-cc').value),hp=Number(q('car-hp').value);
 q('calc-lines').replaceChildren();
 const params=`Цена: ${Number.isFinite(price)?price.toLocaleString('ru-RU'):'—'} ${state.currency}\nВозраст: ${labelMap[state.age]}\nДвигатель: ${labelMap[state.engine]}\nОбъём: ${cc||'—'} см³\nМощность: ${hp||'—'} л.с.\nВвоз: ${labelMap[state.importer]}`;
 const result=compute({price,rate,eur,cc,hp});
 if(!result){
  q('calc-total').textContent='—';q('calc-caption').textContent='Укажите цену и параметры автомобиля';q('calc-warning').textContent='';
  updateMessages('Здравствуйте! Хочу рассчитать автомобиль.\n'+params);return;
 }
 addLine('Стоимость автомобиля',fmt(result.carRub),`${price.toLocaleString('ru-RU')} ${state.currency} × ${rate.toFixed(4)} ₽`);
 if(result.bankFee>0)addLine('Комиссия банка (Китай, 2%)',fmt(result.bankFee),'2% от стоимости автомобиля');
 if(result.logistics)addLine(result.logistics.title,fmt(result.logisticsRub),result.logistics.note);
 addLine('Таможенная пошлина',fmt(result.duty.rub),result.duty.how);
 if(result.excise>0)addLine('Акциз',fmt(result.excise),'Для коммерческого ввоза');
 if(result.vat>0)addLine('НДС 22%',fmt(result.vat),'Для коммерческого ввоза');
 const utilCaveat=state.importer==='private'&&hp<=160&&cc<=3000?'При соблюдении условий личного ввоза':'По объёму и мощности, 2026 год';
 addLine('Утилизационный сбор',fmt(result.util),utilCaveat);
 addLine('Таможенный сбор',fmt(result.clearance),'Государственный платёж');
 addLine('Услуги брокера',fmt(result.broker),'СВХ, разгрузка, СБКТС, ЭПТС, лаборатория');
 const rateOk=source==='live'||source==='cache';
 const total=rateOk?fmt(result.total):'Уточните стоимость';
 q('calc-total').textContent=total;
 q('calc-caption').textContent='Включена указанная логистика за рубежом. Доставка по России и дополнительные услуги Автоимпорт43 рассчитываются отдельно.';
 q('calc-warning').textContent='Предварительная сумма. Условия ввоза и итоговые платежи подтверждаются при оформлении.';
 const parts=['Здравствуйте! Хочу уточнить стоимость автомобиля.',params,'Курс ЦБ на '+dateLabel(rateDate),
  'Машина: '+fmt(result.carRub),...(result.bankFee>0?['Комиссия банка (Китай, 2%): '+fmt(result.bankFee)]:[]),...(result.logistics? [result.logistics.title+': '+fmt(result.logisticsRub)+' ('+result.logistics.note+')']:[]),'Пошлина: '+fmt(result.duty.rub),
  ...(result.excise?['Акциз: '+fmt(result.excise)]:[]),...(result.vat?['НДС: '+fmt(result.vat)]:[]),
  'Утильсбор: '+fmt(result.util),'Таможенный сбор: '+fmt(result.clearance),
  'Услуги брокера: '+fmt(result.broker),'Предварительный итог: '+total,
  'Логистика за рубежом ориентировочная; доставка по России и дополнительные услуги Автоимпорт43 — отдельно.',
   'Установка дополнительного оборудования и бронирование элементов кузова оплачиваются отдельно.','Уточните, пожалуйста, цену под ключ.'];
 updateMessages(parts.join('\n'));
}
for(const group of document.querySelectorAll('#calculate .calc-choices[data-key]'))group.addEventListener('click',e=>{
 const btn=e.target.closest('button[data-value]');if(!btn)return;
 group.querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b===btn));
 state[group.dataset.key]=btn.dataset.value;syncRates();calc();
});
for(const key of ['car-price','car-cc','car-hp'])q(key).addEventListener('input',calc);
q('fx-refresh').addEventListener('click',loadRates);
const presets={japan:{currency:'JPY',age:'3to5',engine:'ice',importer:'private',price:2500000,cc:1498,hp:120},china:{currency:'CNY',age:'lt3',engine:'ice',importer:'private',price:150000,cc:1998,hp:155},korea:{currency:'KRW',age:'3to5',engine:'ice',importer:'private',price:25000000,cc:1598,hp:150}};
for(const btn of document.querySelectorAll('.preset'))btn.addEventListener('click',()=>{
 const x=presets[btn.dataset.preset];if(!x)return;
 Object.assign(state,{currency:x.currency,age:x.age,engine:x.engine,importer:x.importer});
 q('car-price').value=x.price;q('car-cc').value=x.cc;q('car-hp').value=x.hp;
 document.querySelectorAll('#calculate .calc-choices[data-key]').forEach(g=>g.querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.dataset.value===state[g.dataset.key])));
 syncRates();calc();
});
syncRates();calc();loadRates();
// Expose pure calculation for local, automated fixture tests only.
window.AUTO43_TEST_CALCULATE=compute;
window.AUTO43_TEST_SET_STATE=x=>Object.assign(state,x);
})();
