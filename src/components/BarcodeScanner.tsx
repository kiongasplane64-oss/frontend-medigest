// components/BarcodeScanner.tsx
import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera, Loader2 } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      scannerRef.current = new Html5QrcodeScanner(
        "reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true
        },
        false
      );

      scannerRef.current.render(
        (decodedText) => {
          onScan(decodedText);
          if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
          }
        },
        (errorMessage) => {
          console.warn(errorMessage);
          if (errorMessage.includes('NotFound')) {
            setError("Caméra non trouvée");
          }
        }
      );

      setIsInitializing(false);
    } catch (err) {
      setError("Erreur lors de l'initialisation de la caméra");
      console.error(err);
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Camera className="text-medical" size={20} />
            <h3 className="text-lg font-black uppercase italic text-slate-900">
              Scanner code-barres
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {isInitializing && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-medical" size={32} />
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        <div id="reader" className="w-full overflow-hidden rounded-xl"></div>

        <p className="text-center text-sm text-slate-500 mt-4">
          Placez le code-barres devant la caméra
        </p>

        <div className="mt-4 p-4 bg-blue-50 rounded-xl text-xs text-blue-700">
          <p className="font-bold mb-1">📱 Astuce :</p>
          <p>Assurez-vous que le code-barres est bien éclairé et centré dans le cadre</p>
        </div>
      </div>
    </div>
  );
}