// No celular este componente não é usado (o DateTimeField abre o seletor nativo).
// A versão do navegador fica em WebDateTimeInput.web.tsx.
export interface WebDateTimeInputProps {
  mode: 'date' | 'time';
  value: string;
  onChange: (value: string) => void;
  label: string;
  dark: boolean;
  colors: { text: string; surface: string; border: string };
}

export function WebDateTimeInput(_props: WebDateTimeInputProps) {
  return null;
}
