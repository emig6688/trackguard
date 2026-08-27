"use client";

import { useEffect, useState } from "react";
import { Volume2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

// Web Speech API: gratis, corre en el navegador, no genera ningún archivo —
// solo funciona con la pestaña abierta. El botón se renderiza siempre (se
// evita chequear "speechSynthesis in window" en el render/efecto inicial,
// que en SSR desincroniza el markup del servidor con el del cliente); si el
// navegador no la soporta, alternar() simplemente no hace nada.
function elegirVozEnEspanol(): SpeechSynthesisVoice | undefined {
  const voces = window.speechSynthesis.getVoices();
  return voces.find((v) => v.lang === "es-AR") ?? voces.find((v) => v.lang?.startsWith("es"));
}

export function BotonResumenVoz({ texto }: { texto: string }) {
  const [hablando, setHablando] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function alternar() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (hablando) {
      window.speechSynthesis.cancel();
      setHablando(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "es-AR";
    const voz = elegirVozEnEspanol();
    if (voz) utterance.voice = voz;
    utterance.onend = () => setHablando(false);
    utterance.onerror = () => setHablando(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setHablando(true);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={alternar} className="gap-1.5">
      {hablando ? <Square className="size-3.5" /> : <Volume2 className="size-3.5" />}
      {hablando ? "Detener" : "Escuchar resumen"}
    </Button>
  );
}
