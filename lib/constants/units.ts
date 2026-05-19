// ============================================================
// Unità di misura condivise tra VociTable (via PreventivoForm/FatturaForm)
// e CatalogItemForm.
// FONTE DI VERITÀ — non duplicare questa lista nei singoli componenti.
// I valori ("value") coincidono con quelli salvati nel campo `unit` del DB.
// ============================================================

export interface UnitOption {
  /** Valore salvato nel DB */
  value: string
  /** Label breve mostrata nel select */
  label: string
}

export const UNIT_OPTIONS: UnitOption[] = [
  { value: 'pz',       label: 'pz'       },
  { value: 'ore',      label: 'ore'      },
  { value: 'gg',       label: 'gg'       },
  { value: 'mq',       label: 'mq'       },
  { value: 'ml',       label: 'ml'       },
  { value: 'mc',       label: 'mc'       },
  { value: 'kg',       label: 'kg'       },
  { value: 'lt',       label: 'lt'       },
  { value: 'lotto',    label: 'lotto'    },
  { value: 'servizio', label: 'servizio' },
]

/** Array dei soli valori — usato nei SelectItem dei form */
export const UNIT_VALUES: string[] = UNIT_OPTIONS.map((u) => u.value)
