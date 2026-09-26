// Dopo un invio riuscito dal pop-up «Invia al cliente» (Copia, WhatsApp,
// Altre app, Email, reinvio, riapertura): se l'utente era nella MODIFICA
// (?edit=1, il form su mobile) si torna alla vista del documento — il
// documento è partito, restare nel form lascia credere che manchi qualcosa
// (Eli, 26 set: «dopo aver confermato non torna alla schermata dove si vede
// l'anteprima»). Fuori dalla modifica basta ricaricare i dati della pagina.

type RouterLike = { replace: (href: string) => void; refresh: () => void }

export function aggiornaDopoInvio(router: RouterLike): void {
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href)
    if (url.searchParams.get('edit') === '1') {
      url.searchParams.delete('edit')
      router.replace(url.pathname + url.search + url.hash)
      router.refresh()
      return
    }
  }
  router.refresh()
}
