import { WebLN } from "@/global";
import { useRef, useEffect } from "react";

export const useLightning = () => {
  const webln = useRef<WebLN | null>(null);

  useEffect(() => {
    if (!webln.current) {
      try {
        webln.current = window.webln;
      } catch (e) {
        console.error(e);
        throw new Error("WebLN is not available");
      }
    }
    webln.current.enable().then(console.log).catch(console.error);
  });

  const payInvoice = async (invoice: string) => {
    if (!webln.current) throw new Error("WebLN is not available");
    try {
      return await webln.current.sendPayment(invoice);
    } catch (e) {
      console.error(e);
    }
  };

  const makeInvoice = async (amount: number) => {
    if (!webln.current) throw new Error("WebLN is not available");
    try {
      return await webln.current.makeInvoice(amount);
    } catch (e: any) {
      throw new Error("Could not make invoice", e.message);
    }
  };

  const getAmountSatFromInvoice = (invoice: string) => {
    const decodedInvoice = require("light-bolt11-decoder").decode(invoice);
    const amountSection = decodedInvoice.sections.find(
      (s: any) => s.name === "amount"
    );

    if (!amountSection) {
      console.error("No amount section found in invoice");
      return;
    }

    return amountSection.value / 1000;
  };

  return {
    payInvoice,
    makeInvoice,
    getAmountSatFromInvoice,
  };
};
