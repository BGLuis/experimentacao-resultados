import { useRef, useState } from 'react';
import { Database, FileSpreadsheet, RotateCcw, SlidersHorizontal, Upload, X } from 'lucide-react';
import { Badge } from './UiPrimitives';

interface HeaderBarProps {
  sourceLabel: string;
  isCustomCsv: boolean;
  totalRaw: number;
  totalValid: number;
  normalizeTools: boolean;
  onToggleNormalizeTools: () => void;
  onUploadCsv: (csvText: string, fileName: string) => void;
  onRestoreRepoCsv: () => void;
}

export function HeaderBar({
  sourceLabel,
  isCustomCsv,
  totalRaw,
  totalValid,
  normalizeTools,
  onToggleNormalizeTools,
  onUploadCsv,
  onRestoreRepoCsv,
}: HeaderBarProps) {
  const [dropzoneOpen, setDropzoneOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
      setUploadError('Selecione um arquivo .csv exportado do Google Forms.');
      return;
    }
    try {
      const text = await file.text();
      if (!text.trim()) {
        setUploadError('O arquivo CSV está vazio.');
        return;
      }
      setUploadError(null);
      onUploadCsv(text, file.name);
      setDropzoneOpen(false);
    } catch {
      setUploadError('Não foi possível ler o arquivo selecionado.');
    }
  };

  return (
    <header className="border-b border-[#D5DDD6] bg-[#FFFFFF]">
      <div className="mx-auto max-w-[1440px] px-4 py-3.5 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded bg-[#1F4E8C] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white">
                <Database className="h-3 w-3" aria-hidden="true" />
                PUC Minas · 2026/2
              </span>
              <span className="text-xs font-medium text-[#5C6D75]">
                Medição e Experimentação em Engenharia de Software — Parte 2 (Resultados)
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#142027] sm:text-2xl">
              Qualidade e Velocidade com Assistentes de IA
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#43535B]">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <FileSpreadsheet className="h-3.5 w-3.5 text-[#1F4E8C]" aria-hidden="true" />
                Fonte ativa: <span className="font-mono-tabular font-semibold text-[#142027]">{sourceLabel}</span>
              </span>
              <span className="text-[#D5DDD6]">•</span>
              <Badge variant={isCustomCsv ? 'warning' : 'success'}>
                {isCustomCsv ? 'CSV externo carregado' : 'CSV do repositório'}
              </Badge>
              <span className="font-mono-tabular text-[#43535B]">
                Brutas: <strong>{totalRaw}</strong> → Válidas: <strong>{totalValid}</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-lg border border-[#D5DDD6] bg-[#EDF1EC] px-3 py-1.5 text-xs font-medium text-[#142027] hover:bg-[#E4EAE3] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={normalizeTools}
                onChange={onToggleNormalizeTools}
                className="h-3.5 w-3.5 rounded border-[#5C6D75] accent-[#1F4E8C]"
              />
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#43535B]" aria-hidden="true" />
              <span>
                Normalizar ferramentas (<code className="font-mono-tabular text-[11px]">kiro aws → Kiro</code>)
              </span>
            </label>

            <button
              type="button"
              onClick={() => setDropzoneOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F4E8C] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#183E70]"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Carregar CSV
            </button>

            <button
              type="button"
              onClick={onRestoreRepoCsv}
              disabled={!isCustomCsv}
              title={
                isCustomCsv
                  ? 'Restaurar o arquivo /questions.csv padrão do repositório'
                  : 'Já está utilizando o CSV padrão do repositório'
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                isCustomCsv
                  ? 'border-[#D5DDD6] bg-white text-[#142027] hover:bg-[#EDF1EC]'
                  : 'border-[#D5DDD6] bg-[#F4F6F3] text-[#5C6D75] opacity-60 cursor-not-allowed'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Restaurar CSV do repositório
            </button>
          </div>
        </div>

        {dropzoneOpen && (
          <div className="mt-3 rounded-lg border border-[#B6CBE6] bg-[#F8FAFC] p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold text-[#142027]">
                Importar nova exportação CSV do Google Forms (processamento 100% local no navegador)
              </div>
              <button
                type="button"
                onClick={() => {
                  setDropzoneOpen(false);
                  setUploadError(null);
                }}
                aria-label="Fechar área de importação CSV"
                className="rounded p-1 text-[#5C6D75] hover:bg-[#EDF1EC] hover:text-[#142027]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                void handleFile(e.dataTransfer.files?.[0]);
              }}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
                isDragging
                  ? 'border-[#1F4E8C] bg-[#E8EFF8]'
                  : 'border-[#B8C4B9] bg-white hover:border-[#1F4E8C]'
              }`}
            >
              <Upload className="h-6 w-6 text-[#1F4E8C]" aria-hidden="true" />
              <p className="text-xs text-[#43535B]">
                Arraste e solte o arquivo <code className="font-mono-tabular font-semibold">.csv</code> aqui ou{' '}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="font-semibold text-[#1F4E8C] underline underline-offset-2 hover:text-[#183E70]"
                >
                  selecione do computador
                </button>
              </p>
              <p className="text-[11px] text-[#5C6D75]">
                O motor mapeia colunas pelo texto dos enunciados do protocolo (imune à ordem embaralhada).
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  void handleFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>

            {uploadError && (
              <p className="mt-2 text-xs font-medium text-[#B83B3B]">{uploadError}</p>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
