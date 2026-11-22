import { useEffect, useState } from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import {
  canPrintSilently,
  guessReceiptPrinter,
  listPrinters,
  loadPrinterSettings,
  printSilently,
  savePrinterSettings,
  testReceipt,
  type PrinterInfo,
  type PrinterSettings,
} from '../lib/printer';
import { Button, Field, Modal, Select, cn } from '../ui';

/** Pick the receipt printer once; receipts then print without any dialog. */
export function PrinterSettingsModal({ open, onClose, notify }: { open: boolean; onClose: () => void; notify: (m: string) => void }) {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [name, setName] = useState('');
  const [widthDots, setWidthDots] = useState<PrinterSettings['widthDots']>(576);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listPrinters();
      setPrinters(list);
      const saved = loadPrinterSettings();
      setName(saved?.name && list.some((p) => p.name === saved.name) ? saved.name : guessReceiptPrinter(list)?.name ?? '');
      if (saved?.widthDots) setWidthDots(saved.widthDots);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void load();
  }, [open]);

  const settings: PrinterSettings = { name, widthDots };

  return (
    <Modal open={open} onClose={onClose} title="Chek printeri">
      {!canPrintSilently() ? (
        <p className="text-sm text-ink-soft">Bu sozlama faqat kompyuterga o‘rnatilgan kassa ilovasida ishlaydi.</p>
      ) : (
        <div className="space-y-4">
          <Field label="Printer" hint="Xprinter (yoki boshqa chek printeri)ni tanlang. Chek oynasiz, to‘g‘ridan-to‘g‘ri chiqadi.">
            <div className="flex gap-2">
              <Select value={name} onChange={(e) => setName(e.target.value)} className="h-12 flex-1">
                {printers.length === 0 && <option value="">Printer topilmadi</option>}
                {printers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                    {p.is_default ? ' (asosiy)' : ''}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" className="h-12" onClick={() => void load()} loading={loading} title="Qayta qidirish">
                <RefreshCw size={16} />
              </Button>
            </div>
          </Field>
          <Field label="Qog‘oz eni">
            <div className="grid grid-cols-2 gap-2">
              {([576, 384] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setWidthDots(w)}
                  className={cn('h-12 rounded-xl text-sm font-semibold ring-1', widthDots === w ? 'bg-primary text-white ring-primary' : 'bg-white ring-line')}
                >
                  {w === 576 ? '80 mm' : '58 mm'}
                </button>
              ))}
            </div>
          </Field>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-between gap-2 border-t border-line pt-4">
            <Button
              variant="secondary"
              disabled={!name}
              loading={testing}
              onClick={async () => {
                setTesting(true);
                setError(null);
                try {
                  await printSilently(testReceipt(), settings);
                  notify('Sinov cheki yuborildi');
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setTesting(false);
                }
              }}
            >
              <Printer size={16} /> Sinov cheki
            </Button>
            <Button
              disabled={!name}
              onClick={() => {
                savePrinterSettings(settings);
                notify(`Printer saqlandi: ${name}`);
                onClose();
              }}
            >
              Saqlash
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
