export interface WebLN {
  sendPayment(paymentRequest: string): Promise<void>;
  makeInvoice(amount: number): Promise<{ paymentRequest: string }>;
  enable(): Promise<void>;
}

// add WebLN to the window object
declare global {
  interface Window {
    webln: WebLN;
  }
}

export {};
