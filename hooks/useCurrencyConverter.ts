export enum Unit {
  usd = "usd",
  sat = "sat",
}

export const useCurrencyConverter = () => {
  const getCentsPerSatoshi = async (
    exchangeRateApi = "https://mempool.space/api/v1/prices"
  ): Promise<number> => {
    const response = await fetch(exchangeRateApi);
    const data = await response.json();
    const usdBtc = parseInt(data.USD);

    if (!usdBtc) {
      throw new Error("Could not fetch exchange rate");
    }

    const btcValueInCents = usdBtc * 100;

    const centsPerSatoshi = btcValueInCents / 100_000_000;

    console.log("1 satoshi is worth ", centsPerSatoshi, " cents");

    return centsPerSatoshi;
  };

  const centsToSats = async (cents: number): Promise<number> => {
    const centsPerSatoshi = await getCentsPerSatoshi();

    const sats = Math.floor(cents / centsPerSatoshi);

    return sats;
  };

  const convertToSats = async (amount: number, unit: Unit): Promise<number> => {
    switch (unit) {
      case Unit.usd:
        const cents = amount;
        return centsToSats(cents);
      case Unit.sat:
        return amount;
      default:
        throw new Error("Unsupported unit");
    }
  };

  return {
    convertToSats,
  };
};
