import Head from "next/head";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Inter } from "next/font/google";
import styles from "@/styles/Home.module.css";
import {
  CashuMint,
  CashuWallet,
  GetInfoResponse,
  MeltQuoteResponse,
  MeltTokensResponse,
  MintAllKeysets,
  Proof,
  RequestMintResponse,
} from "@cashu/cashu-ts";
import request from "@cashu/cashu-ts/dist/lib/es5/request";
import { joinUrls } from "@cashu/cashu-ts/dist/lib/es5/utils";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  const [mintData, setMintData] = useState({});
  const [swapData, setSwapData] = useState({});
  const [meltData, setMeltData] = useState({});
  const [mintQuoteId, setMintQuoteId] = useState("");
  const [invoice, setInvoice] = useState("");
  const [meltQuoteRes, setMeltQuoteRes] = useState<MeltQuoteResponse>();
  const [runTests, setRunTests] = useState(false);

  const mint = new CashuMint(
    // "https://nwc-mint.vercel.app/clun3vlkx00007snohdado6hy"
    "http://localhost:5019/cluubdh1x0000ajib368whjmj"
  );

  const mintMeltAmount = 5000;

  const wallet = new CashuWallet(mint);

  const resetTokenState = () => {
    localStorage.setItem("proofs", "[]");
  };

  const testInfoRoute = async (wallet: CashuWallet) => {
    const info = await wallet.mint.getInfo();

    console.log("Info: ", info);

    const infoFields = [
      "name",
      "pubkey",
      "contact",
      "version",
      "description",
      "description_long",
      "nuts",
    ];

    infoFields.forEach((field) => {
      if (!info[field as keyof GetInfoResponse]) {
        throw new Error(`Info field ${field} not found.`);
      }
    });
  };

  const testKeyRoutes = async (wallet: CashuWallet) => {
    const keys = await wallet.mint.getKeys();

    console.log("Keys: ", keys);

    const keysets: MintAllKeysets = await wallet.mint.getKeySets();

    console.log("Keysets: ", keysets);

    if (keysets) {
      const keyset = await wallet.mint.getKeys(keysets.keysets[0].id);
      console.log("Keyset: ", keyset);

      if (keyset.id !== keysets.keysets[0].id) {
        throw new Error("Keyset ID mismatch.");
      }
    }
  };

  const testMintRoutes = async (wallet: CashuWallet) => {
    console.log("Testing mint routes...");
    resetTokenState();

    const mintQuote = await wallet.getMintQuote(mintMeltAmount);

    try {
      await (window as any).webln.enable();

      await (window as any).webln.sendPayment(mintQuote.request);
    } catch (e) {
      alert("Error sending payment: " + e);
    }

    console.log("Mint Quote: ", mintQuote);

    const mintTokens = await wallet.mintTokens(mintMeltAmount, mintQuote.quote);

    console.log("Mint Tokens response: ", mintTokens);

    const totalMinted = mintTokens.proofs.reduce(
      (acc, proof) => acc + proof.amount,
      0
    );

    if (totalMinted !== mintMeltAmount) {
      throw new Error("Incorrect total minted amount.");
    }

    updateStoredProofs([...mintTokens.proofs]);

    const checkMintQuote = (await request({
      endpoint: joinUrls(
        mint.mintUrl,
        `/v1/mint/quote/bolt11/${mintQuote.quote}`
      ),
    })) as any;

    console.log("Check Mint Quote: ", checkMintQuote);

    if (checkMintQuote.paid) {
      console.log("Mint quote was paid.");

      try {
        const mintTokens = await wallet.mintTokens(
          mintMeltAmount,
          mintQuote.quote
        );
        console.error("Mint quote was paid again. This is bad.");
      } catch (e) {
        console.log("Quote not issued again. This is good.");
      }
    } else {
      throw new Error("Mint quote was not paid.");
    }
  };

  const testSwapRoutes = async (wallet: CashuWallet) => {
    console.log("Testing swap routes...");
    const tokens = JSON.parse(
      localStorage.getItem("proofs") || "[]"
    ) as Proof[];

    if (tokens.length < 1) {
      throw new Error("No tokens to swap.");
    }

    const swapTokens = await wallet.send(3, tokens);

    console.log("Swap Tokens response: ", swapTokens);

    const totalSent = swapTokens.send.reduce(
      (acc, proof) => acc + proof.amount,
      0
    );

    if (totalSent !== 3) {
      throw new Error("Incorrect total sent amount.");
    }

    const totalChange = swapTokens.returnChange.reduce(
      (acc, proof) => acc + proof.amount,
      0
    );

    // TODO: Fix this check...
    // if (totalChange !== 2) {
    //   throw new Error("Incorrect total change amount.");
    // }

    const duplicateSwap = tokens.some((token) => {
      const sent = swapTokens.send.some((sent) => sent.secret === token.secret);
      const change = swapTokens.returnChange.some(
        (change) => change.secret === token.secret
      );
      if (sent || change) {
        console.log("Duplicate swap: ", sent, change);
        return true;
      }
      return false;
    });

    console.log("Duplicate swap: ", duplicateSwap);

    // TODO: Fix this check...
    // if (duplicateSwap) {
    //   throw new Error(
    //     "Duplicate swap. Got back tokens with same id as those sent"
    //   );
    // }

    resetTokenState();
    updateStoredProofs([...swapTokens.returnChange, ...swapTokens.send]);
    console.log("Tokens swapped successfully.");
  };

  const testMeltRoutes = async (wallet: CashuWallet) => {
    console.log("Testing melt routes...");
    let tokens = JSON.parse(localStorage.getItem("proofs") || "[]") as Proof[];

    if (tokens.length < 1) {
      try {
        const mintQuote = await wallet.getMintQuote(mintMeltAmount);
        const invoice = mintQuote.request;

        await (window as any).webln.enable();
        await (window as any).webln.sendPayment(invoice);

        const mintTokens = await wallet.mintTokens(
          mintMeltAmount,
          mintQuote.quote
        );
        tokens = mintTokens.proofs;
      } catch (e) {
        console.error("Error minting tokens: ", e);
        return;
      }
    }

    let invoice = "";
    // let invoice =
    //   "lnbc49500n1pnp2mx6pp56cmpq75zgpdf9l2pzapjat29snvfffcx3fvvwzy6r0qeg8ar6rwsdpjge6kuerfdenjqsr8w4jxuatxyphkugrnw3skx6m9wghxuethwvcqzzsxqrrsssp5mpsjca9s4ac7s8qm8ta6wfqz3ue984ys6vcdkr86gvl5haldh6yq9qyyssqakyxwmfqsrdu3w2llpepwlzhhctudf34z4yjlwql8fz8ml4qzuhzha5ly69pngarf7wuqqc2zv0ay725mlqnm2swderq4w9n9yj3e6spl9zxfu";
    if (!invoice) {
      try {
        const invoiceRes = await (window as any).webln.makeInvoice(
          mintMeltAmount - 50
        );
        invoice = invoiceRes.paymentRequest;
        if (!invoice) {
          throw new Error("No invoice made.");
        }
      } catch (e) {
        console.error("Error making invoice: ", e);
      }
    }

    const meltQuote = await wallet.getMeltQuote(invoice);

    console.log("Melt Quote: ", meltQuote);

    const meltedTokens: MeltTokensResponse = await wallet.meltTokens(
      meltQuote,
      tokens
    );

    console.log("Melt Tokens response: ", meltedTokens);
  };

  const payInvoice = async (invoice: string) => {
    try {
      await (window as any).webln.enable();
      await (window as any).webln.sendPayment(invoice);
    } catch (e) {
      console.error("Error sending payment: ", e);
    }
  };

  const getInvoice = async (amount: number) => {
    try {
      await (window as any).webln.enable();
      const invoiceRes = await (window as any).webln.makeInvoice(amount);
      return invoiceRes.paymentRequest;
    } catch (e) {
      console.error("Error making invoice: ", e);
    }
  };

  const tryToDoubleSpend = async (wallet: CashuWallet) => {
    console.log("Trying to double spend...");
    resetTokenState();
    const mintQuote = await wallet.getMintQuote(mintMeltAmount);
    await payInvoice(mintQuote.request);

    const mintTokens = await wallet.mintTokens(mintMeltAmount, mintQuote.quote);

    const tokens = mintTokens.proofs;

    const { send, returnChange } = await wallet.send(
      mintMeltAmount - mintMeltAmount / 2,
      tokens
    );

    // try to double spend the tokens we just swapped...

    try {
      const doubleSpend = await wallet.send(
        mintMeltAmount - mintMeltAmount / 2,
        tokens
      );
      console.error("Double spend successful: ", doubleSpend);
    } catch (e) {
      console.log("Failed to double spend after swap");
    }

    // melt the tokens we just swapped...

    // the amount to try to double spend next
    const sendAmount = send.reduce((acc, proof) => acc + proof.amount, 0);
    const invoice = await getInvoice(sendAmount);

    const meltQuote = await wallet.getMeltQuote(invoice);

    const { change } = await wallet.meltTokens(meltQuote, send);

    // try to double spend the tokens we just melted...

    try {
      console.log("Trying to double spend after melt...");
      const doubleSpend = await wallet.send(sendAmount - sendAmount / 2, send);
      console.error("Double spend successful: ", doubleSpend);
    } catch (e) {
      console.log("Failed to double spend after melt");
    }
  };

  const mintTokens = async (wallet: CashuWallet, amountSat: number) => {
    const mintQuote = await wallet.getMintQuote(amountSat);

    await payInvoice(mintQuote.request);

    const { proofs } = await wallet.mintTokens(amountSat, mintQuote.quote);

    return proofs;
  };

  const testCheckstate = async (wallet: CashuWallet) => {
    console.log("Testing /v1/checkstate");
    resetTokenState();

    console.log("Minting 15 sats...");
    const shouldBeUnspent = await mintTokens(wallet, 15);

    const checkstate1 = await wallet.checkProofsSpent(shouldBeUnspent);
    console.log(
      `Found ${checkstate1.length} proofs spent from shouldBeUnspent`
    );

    if (checkstate1.length !== 0) {
      throw new Error("Proofs should be unspent.");
    }

    const { send, returnChange } = await wallet.send(10, shouldBeUnspent);

    const shouldBeSpent = shouldBeUnspent;

    const checkstate2 = await wallet.checkProofsSpent(shouldBeSpent);
    console.log(`Found ${checkstate2.length} proofs spent from shouldBeSpent`);

    if (checkstate2.length !== shouldBeSpent.length) {
      console.log("Checkstate2: ", checkstate2);
      console.log("ShouldBeSpent: ", shouldBeSpent);
      throw new Error("Proofs should be spent.");
    }
  };

  const testMint = async (wallet: CashuWallet) => {
    // await testInfoRoute(wallet);
    // await testKeyRoutes(wallet);
    await testMintRoutes(wallet);
    await testSwapRoutes(wallet);
    await testMeltRoutes(wallet);

    await tryToDoubleSpend(wallet);

    await testCheckstate(wallet);
  };

  useEffect(() => {
    if (!runTests) return;
    const run = async () => {
      try {
        await testMint(wallet);
        setRunTests(false);
      } catch (e) {
        console.error("Testing Error: ", e);
        setRunTests(false);
      }
    };
    run();
  }, [runTests]);

  const updateStoredProofs = (proofs: Proof[]) => {
    const currentProofs = localStorage.getItem("proofs");
    if (currentProofs) {
      const parsedProofs = JSON.parse(currentProofs);
      localStorage.setItem(
        "proofs",
        JSON.stringify([...parsedProofs, ...proofs])
      );
    } else {
      localStorage.setItem("proofs", JSON.stringify([...proofs]));
    }
  };

  const getMintInvoice = async () => {
    try {
      const getMintQuoteRes = await wallet.getMintQuote(5);
      setMintData(getMintQuoteRes);
      setMintQuoteId(getMintQuoteRes.quote);
    } catch (err) {
      console.log(err);
    }
  };

  const getTokens = async () => {
    try {
      const mintTokensRes = await wallet.mintTokens(5, mintQuoteId);
      setMintData(mintTokensRes);
      updateStoredProofs([...mintTokensRes.proofs]);
    } catch (err) {
      console.log(err);
    }
  };

  const swapTokens = async () => {
    try {
      const ourTokens = JSON.parse(localStorage.getItem("proofs") || "[]");
      console.log(ourTokens);
      const swapTokensRes = await wallet.send(2, ourTokens);
      setSwapData(swapTokensRes);
      localStorage.setItem("proofs", "[]");
      updateStoredProofs([
        ...swapTokensRes.returnChange,
        ...swapTokensRes.send,
      ]);
    } catch (err) {
      setSwapData("Error swapping tokens.");
      console.log(err);
    }
  };

  const getMeltQuote = async () => {
    console.log("invoice", invoice);
    if (!invoice) {
      setMeltData("Must input an invoice");
      return;
    }
    try {
      const getMeltQuoteRes = await wallet.getMeltQuote(invoice);
      setMeltData(getMeltQuoteRes);
      setMeltQuoteRes(getMeltQuoteRes);
    } catch (err) {
      console.log(err);
    }
  };

  const meltTokens = async () => {
    if (!meltQuoteRes) {
      setMeltData("Must get a melt quote first.");
      return;
    }
    try {
      const proofs = JSON.parse(localStorage.getItem("proofs") || "[]");
      const meltTokensRes = await wallet.meltTokens(meltQuoteRes, proofs);
      setMeltData(meltTokensRes);
      updateStoredProofs(meltTokensRes.change);
    } catch (e) {
      console.log(e);
    }
  };

  const hanldeRunMeltTest = async () => {
    try {
      resetTokenState();
      testMeltRoutes(wallet);
    } catch (e) {
      console.log(e);
    }
  };

  const handleRunTests = () => {
    if (runTests) {
      return;
    }
    setRunTests(true);
  };

  return (
    <>
      <Head>
        <title>Create Next App</title>
      </Head>
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "100px",
        }}
      >
        <div>
          <button onClick={handleRunTests}>Run Tests</button>
        </div>
        <div
          style={{
            marginBottom: "20px",
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-around",
          }}
        >
          <button style={{ marginRight: "20px" }} onClick={getMintInvoice}>
            Get Mint Quote
          </button>
          <button style={{ marginRight: "20px" }} onClick={getTokens}>
            Mint Tokens
          </button>
        </div>
        <div
          style={{
            maxWidth: "75%",
            padding: "20px",
            // background: "#f0f0f0",
            borderRadius: "8px",
          }}
        >
          <pre style={{ whiteSpace: "pre-wrap", wordWrap: "break-word" }}>
            {JSON.stringify(mintData, null, 2)}
          </pre>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <button style={{ marginRight: "20px" }} onClick={swapTokens}>
            Swap Tokens
          </button>
        </div>
        <div
          style={{
            maxWidth: "75%",
            padding: "20px",
            // background: "#f0f0f0",
            borderRadius: "8px",
          }}
        >
          <pre style={{ whiteSpace: "pre-wrap", wordWrap: "break-word" }}>
            {JSON.stringify(swapData, null, 2)}
          </pre>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <input
            placeholder="invoice to pay"
            type="text"
            onChange={(e) => setInvoice(e.target.value)}
            style={{ marginRight: "20px" }}
          />
          <button style={{ marginRight: "20px" }} onClick={getMeltQuote}>
            Get Melt Quote
          </button>
          <button style={{ marginRight: "20px" }} onClick={meltTokens}>
            Melt Tokens
          </button>
          <button onClick={hanldeRunMeltTest}>Test Melt Routes</button>
        </div>
        <div
          style={{
            maxWidth: "75%",
            padding: "20px",
            // background: "#f0f0f0",
            borderRadius: "8px",
          }}
        >
          <pre style={{ whiteSpace: "pre-wrap", wordWrap: "break-word" }}>
            {JSON.stringify(meltData, null, 2)}
          </pre>
        </div>
      </main>
    </>
  );
}
