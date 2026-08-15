import { redirect } from 'next/navigation'

// Abbonamento e inviti sono confluiti in «Account e abbonamento» (#11, 15 ago).
// Questo vecchio indirizzo rimanda lì, così eventuali link salvati non si
// rompono.
export default function AbbonamentoInvitiRedirect() {
  redirect('/account')
}
