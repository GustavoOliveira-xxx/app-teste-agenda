// Fusos horários mais usados (nomes IANA). O fuso do celular é sempre
// incluído na lista, mesmo que não esteja aqui.
import type { Option } from '@/components/OptionSheet';

const ZONES: [string, string][] = [
  ['America/Sao_Paulo', 'Brasília, São Paulo, Rio, Sul e Sudeste'],
  ['America/Bahia', 'Bahia'],
  ['America/Fortaleza', 'Nordeste (Fortaleza, Recife, Natal)'],
  ['America/Recife', 'Recife'],
  ['America/Belem', 'Belém'],
  ['America/Manaus', 'Manaus (Amazonas)'],
  ['America/Cuiaba', 'Cuiabá (Mato Grosso)'],
  ['America/Campo_Grande', 'Campo Grande (Mato Grosso do Sul)'],
  ['America/Porto_Velho', 'Porto Velho (Rondônia)'],
  ['America/Boa_Vista', 'Boa Vista (Roraima)'],
  ['America/Rio_Branco', 'Rio Branco (Acre)'],
  ['America/Noronha', 'Fernando de Noronha'],
  ['America/Argentina/Buenos_Aires', 'Buenos Aires'],
  ['America/Montevideo', 'Montevidéu'],
  ['America/Santiago', 'Santiago'],
  ['America/Asuncion', 'Assunção'],
  ['America/Lima', 'Lima'],
  ['America/Bogota', 'Bogotá'],
  ['America/Mexico_City', 'Cidade do México'],
  ['America/New_York', 'Nova York, Miami (EUA Leste)'],
  ['America/Chicago', 'Chicago (EUA Central)'],
  ['America/Denver', 'Denver (EUA Montanhas)'],
  ['America/Los_Angeles', 'Los Angeles (EUA Pacífico)'],
  ['America/Toronto', 'Toronto'],
  ['Europe/Lisbon', 'Lisboa'],
  ['Europe/London', 'Londres'],
  ['Europe/Madrid', 'Madri'],
  ['Europe/Paris', 'Paris'],
  ['Europe/Berlin', 'Berlim'],
  ['Europe/Rome', 'Roma'],
  ['Europe/Amsterdam', 'Amsterdã'],
  ['Europe/Dublin', 'Dublin'],
  ['Europe/Zurich', 'Zurique'],
  ['Africa/Luanda', 'Luanda'],
  ['Africa/Maputo', 'Maputo'],
  ['Asia/Dubai', 'Dubai'],
  ['Asia/Tokyo', 'Tóquio'],
  ['Asia/Shanghai', 'Xangai, Pequim'],
  ['Asia/Kolkata', 'Índia'],
  ['Australia/Sydney', 'Sydney'],
  ['Pacific/Auckland', 'Auckland'],
  ['UTC', 'UTC (tempo universal)'],
];

export function timezoneOptions(deviceTz?: string): Option<string>[] {
  const list = ZONES.map(([value, description]) => ({ value, label: value.replace(/_/g, ' '), description }));
  if (deviceTz && !list.some((z) => z.value === deviceTz)) {
    list.unshift({ value: deviceTz, label: deviceTz.replace(/_/g, ' '), description: 'Fuso do celular' });
  }
  return list;
}
