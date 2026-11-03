import React, { useState } from 'react';
import { Bike, Waves, Zap, Save, Loader2 } from 'lucide-react';
import { useAppData, useGuesthouse } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { getRentals, isSwitchOn } from '../utils/rentalUtils';
import { parsePriceNumber } from '../utils/pricingUtils';

export const ExtraServices: React.FC = () => {
  const gh = useGuesthouse();
  const { isAdmin } = useAppData();
  const rentals = getRentals(gh);
  // Guests only see the rental card when at least one type is switched on;
  // the admin always sees it so they can switch it back on.
  const showRentalCard = rentals.any || isAdmin;

  return (
    <section className="my-8">
      <div className="bg-gradient-to-br from-sky-500 via-sky-600 to-teal-700 rounded-3xl p-5 sm:p-7 text-white shadow-md relative overflow-hidden">
        {/* Background water ripples decoration */}
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-10 pointer-events-none">
          <Waves className="w-80 h-80 text-white" />
        </div>

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-sky-100 text-xs font-semibold mb-3">
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>บริการพิเศษเพื่อความสะดวกสบายของคุณ</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black mb-2 text-white">
            บริการเสริม & สิ่งอำนวยความสะดวก
          </h3>
          <p className="text-sm text-sky-100 mb-6">
            มาพักที่แจ๋วเกสต์เฮ้าส์ แหลมแท่น สบายใจเรื่องการเดินทาง เที่ยวบางแสนได้แบบไร้กังวล
          </p>

          <div className={`grid grid-cols-1 gap-3.5 ${showRentalCard ? 'sm:grid-cols-2' : ''}`}>
            {/* Service 1: Scooter & Motorcycle Rental */}
            {showRentalCard && (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex sm:flex-col items-center sm:items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center shrink-0 font-bold shadow-xs">
                    <Bike className="w-6 h-6 text-slate-900" />
                  </div>
                  <div className="w-full">
                    {rentals.any ? (
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        {rentals.available.map((r) => (
                          <span
                            key={r.key}
                            className={`text-[10px] sm:text-xs text-slate-950 font-black px-2 py-0.5 rounded-md ${
                              r.key === 'electric' ? 'bg-amber-400' : 'bg-emerald-400'
                            }`}
                          >
                            {r.emoji} {r.key === 'electric' ? 'ไฟฟ้า' : 'มอไซค์'} {r.price}.-/วัน
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="inline-block mb-1.5 text-[10px] sm:text-xs bg-slate-900/40 text-white font-bold px-2 py-0.5 rounded-md">
                        ปิดอยู่ · ลูกค้าไม่เห็นบริการนี้
                      </span>
                    )}
                    <h4 className="font-bold text-white text-base leading-tight">
                      บริการเช่ารถมอเตอร์ไซค์
                    </h4>
                    {rentals.any && (
                      <p className="text-xs text-sky-100 mt-1 leading-relaxed">
                        {rentals.available.map((r) => (
                          <React.Fragment key={r.key}>
                            • <strong>{r.name}:</strong> {r.price} บาท / วัน
                            <br />
                          </React.Fragment>
                        ))}
                        ขี่กินลมชมวิวริมหาดบางแสน แหลมแท่น เขาสามมุข ได้อย่างสะดวกสบาย
                      </p>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <RentalAdminEditor
                    // Remount (drop unsaved typing) only when the saved values change.
                    key={[gh.electricScooterPrice, gh.motorcyclePrice, gh.electricScooterEnabled, gh.motorcycleEnabled].join('|')}
                  />
                )}
              </div>
            )}

            {/* Service 2: Prime Beachfront Location */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex sm:flex-col items-center sm:items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-sky-300 text-slate-900 flex items-center justify-center shrink-0 font-bold shadow-xs">
                <Waves className="w-6 h-6 text-slate-900" />
              </div>
              <div>
                <span className="text-xs text-sky-200 font-bold uppercase tracking-wider block">
                  ทำเลทอง แหลมแท่น
                </span>
                <h4 className="font-bold text-white text-base leading-tight">
                  ข้ามถนนถึงทะเล
                </h4>
                <p className="text-xs text-sky-100 mt-1">
                  ห่างหาดบางแสนประมาณ 300 เมตร ลงเล่นน้ำทะเล เดินช็อปปิ้งสตรีทฟู้ด นั่งเตียงผ้าใบ หรือไปร้านสะดวกซื้อได้ง่ายๆ
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

type RentalForm = {
  electricScooterPrice: string;
  motorcyclePrice: string;
  electricScooterEnabled: string;
  motorcycleEnabled: string;
};

/** Admin-only: change both rental prices and show / hide each type, right on the card. */
const RentalAdminEditor: React.FC = () => {
  const gh = useGuesthouse();
  const { saveGuesthouseSettings } = useAppData();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RentalForm>(() => ({
    electricScooterPrice: gh.electricScooterPrice,
    motorcyclePrice: gh.motorcyclePrice,
    electricScooterEnabled: isSwitchOn(gh.electricScooterEnabled) ? 'on' : 'off',
    motorcycleEnabled: isSwitchOn(gh.motorcycleEnabled) ? 'on' : 'off',
  }));

  const rows: { label: string; priceKey: 'electricScooterPrice' | 'motorcyclePrice'; switchKey: 'electricScooterEnabled' | 'motorcycleEnabled' }[] = [
    { label: '⚡ มอเตอร์ไซค์ไฟฟ้า', priceKey: 'electricScooterPrice', switchKey: 'electricScooterEnabled' },
    { label: '🛵 มอเตอร์ไซค์', priceKey: 'motorcyclePrice', switchKey: 'motorcycleEnabled' },
  ];

  const handleSave = async () => {
    for (const row of rows) {
      if (form[row.switchKey] === 'on' && parsePriceNumber(form[row.priceKey]) <= 0) {
        showToast(`กรุณาใส่ราคา${row.label.slice(2)} เป็นตัวเลข เช่น 200 บาท / วัน`, 'error');
        return;
      }
    }
    setSaving(true);
    try {
      await saveGuesthouseSettings({
        ...form,
        electricScooterPrice: form.electricScooterPrice.trim(),
        motorcyclePrice: form.motorcyclePrice.trim(),
      });
      showToast('บันทึกราคาและการแสดงผลบริการเช่ารถแล้ว ลูกค้าเห็นทันที');
    } catch (err) {
      showToast(`บันทึกไม่สำเร็จ: ${(err as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl bg-white text-slate-800 p-3 space-y-2.5 shadow-sm">
      <div className="text-[11px] font-black text-amber-700">🔧 แอดมิน: แก้ราคา / เปิด-ปิดบริการเช่ารถ</div>
      {rows.map((row) => {
        const on = form[row.switchKey] === 'on';
        return (
          <div key={row.priceKey} className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={`${on ? 'ปิด' : 'เปิด'}บริการ${row.label.slice(2)}`}
              onClick={() => setForm({ ...form, [row.switchKey]: on ? 'off' : 'on' })}
              className={`relative w-10 h-6 rounded-full shrink-0 transition-colors cursor-pointer ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold truncate">
                {row.label} <span className={on ? 'text-emerald-600' : 'text-slate-400'}>({on ? 'เปิด' : 'ปิด'})</span>
              </div>
              <input
                type="text"
                value={form[row.priceKey]}
                onChange={(e) => setForm({ ...form, [row.priceKey]: e.target.value })}
                placeholder="เช่น 200 บาท / วัน"
                className="mt-0.5 w-full px-2 py-1 text-xs rounded-lg border border-slate-300 focus:border-sky-500 outline-none"
              />
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        <span>บันทึกราคา & การแสดงผล</span>
      </button>
    </div>
  );
};
