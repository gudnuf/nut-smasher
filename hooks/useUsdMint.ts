import {
  CashuMint,
  CashuWallet,
  MintPayload,
  MintQuotePayload,
  Proof,
} from "@cashu/cashu-ts";
import { Unit, useCurrencyConverter } from "./useCurrencyConverter";
import { useEffect } from "react";
import { useLightning } from "./useLightning";

interface UseUsdMintProps {
  mintUrl: string;
}

export const useUsdMint = ({ mintUrl }: UseUsdMintProps) => {
  const cashuMint = new CashuMint(mintUrl);
  const cashuWallet = new CashuWallet(cashuMint, { unit: "usd" });

  const { convertToSats } = useCurrencyConverter();
  const { payInvoice, makeInvoice, getAmountSatFromInvoice } = useLightning();

  const testAmounts = [1, 10, 100, 1000, 10000, 1.3, 0.5];
  const unit = "usd";

  const testMintTokenConversionRate = async (amount: number) => {
    console.log(`Testing mint token conversion rate for ${amount} ${unit}`);
    const expectedAmountSat = await convertToSats(amount, Unit.usd);

    const mintQuotePayload: MintQuotePayload = {
      unit,
      amount,
    };

    const mintQuote = await cashuMint.mintQuote(mintQuotePayload);

    const decodedAmountSat = getAmountSatFromInvoice(mintQuote.request);

    if (decodedAmountSat !== expectedAmountSat) {
      console.log(`Decoded amount in satoshis:`, decodedAmountSat);
      console.log("Expected amount in satoshis:", expectedAmountSat);

      throw new Error(
        `Decoded amount does not match expected amount for ${amount} ${unit}`
      );
    }
    console.log(`Conversion rate for ${amount} ${unit} is correct`);
  };

  const testMintingUsd = async (amount: number) => {
    const mintQuote = await cashuWallet.getMintQuote(amount);

    const requestedAmountSat = getAmountSatFromInvoice(mintQuote.request);

    await payInvoice(mintQuote.request);

    const minted = await cashuWallet.mintTokens(amount, mintQuote.quote);

    console.log(
      "Minted amount",
      minted.proofs.reduce((acc, proof) => acc + proof.amount, 0)
    );
    console.log("Requested amount", requestedAmountSat);

    const expectedAmountSat = await convertToSats(amount, Unit.usd);
    console.log("Expected amount", expectedAmountSat);

    if (requestedAmountSat !== expectedAmountSat) {
      throw new Error("Minted amount does not match requested amount");
    }

    return minted.proofs;
  };

  const testMeltingUsd = async (proofs: Proof[], amount: number) => {
    const expectedAmountSat = await convertToSats(amount, Unit.usd);

    const invoice = (await makeInvoice(expectedAmountSat)).paymentRequest;

    console.log("Melting invoice", invoice);

    const meltQuote = await cashuWallet.getMeltQuote(invoice);

    console.log("Melt quote", meltQuote);
    if (Math.floor(amount) !== meltQuote.amount) {
      throw new Error("Melt quote amount does not match expected amount");
    }

    const melted = await cashuWallet.meltTokens(meltQuote, proofs);

    console.log("Melted response", melted);
  };

  const testMintingUsdPrecise = async (amountSat: number) => {
    console.log("Minting precise amount", amountSat, "satoshis");

    const usdKeysetId = await cashuMint
      .getKeys()
      .then((keys) => keys.keysets.find((keyset) => keyset.unit === "usd")?.id);

    const mintQuoteReq = {
      unit: "sat",
      amount: amountSat,
      keysetId: usdKeysetId,
    };

    console.log("Mint quote request", mintQuoteReq);

    const mintQuote = await fetch(`${mintUrl}/v1/mint/quote/bolt11`, {
      method: "POST",
      body: JSON.stringify(mintQuoteReq),
      headers: { "Content-Type": "application/json" },
    }).then((res) => res.json());

    console.log("Mint quote", mintQuote);
  };

  useEffect(() => {
    const run = async () => {
      for (const amount of testAmounts) {
        try {
          // await testMintTokenConversionRate(amount);
        } catch (e) {
          console.error(e);
        }
      }
      try {
        const mintAmount = 1.32;
        const mintAmountSat = 65;
        // const newProofs = await testMintingUsd(mintAmount);
        // await testMeltingUsd(newProofs, mintAmount - 0.23);
        await testMintingUsdPrecise(mintAmountSat);
      } catch (e) {
        console.error(e);
      }
    };
    run();
  });
};
