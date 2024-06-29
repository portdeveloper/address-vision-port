import { NextRequest } from "next/server";
import { ImageResponse } from "@vercel/og";
import { blo } from "blo";
import { Address, createPublicClient, formatEther, http } from "viem";
import { mainnet } from "viem/chains";

export const config = {
  runtime: "edge",
};

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

async function fetchBalance(address: Address): Promise<string | null> {
  try {
    const balance = await publicClient.getBalance({ address });
    return formatEther(balance);
  } catch (error) {
    console.error(`Error fetching balance for address ${address}:`, error);
    return null;
  }
}

const isAddress = (address: string) => {
  return /^(0x)?[0-9a-f]{40}$/i.test(address);
};

export default async function handler(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  if (!searchParams.has("addyOrEns")) {
    return new Response("Missing 'addyOrEns' query parameter", { status: 400 });
  }

  const addyOrEns = searchParams.get("addyOrEns")?.slice(0, 100) || "blank";
  const isAddressValid = isAddress(addyOrEns as string);
  const isEnsValid = /\.(eth|xyz)$/.test(addyOrEns as string);
  const balance = (await fetchBalance(addyOrEns as Address)) || "0";

  if (!isAddressValid && !isEnsValid) {
    return new Response("Invalid address or ENS", { status: 400 });
  }

  console.time("ENSData API Fetch");
  const response = await fetch(`https://api.ensdata.net/${addyOrEns}`);
  console.timeEnd("ENSData API Fetch");

  if (!response.ok) {
    return new Response("ENS data not found", { status: 404 });
  }

  const data = await response.json();
  const resolvedAddress = data.address;
  const resolvedEnsName = data.ens;
  const avatarUrl = data.avatar_small || blo(resolvedAddress);

  const croppedAddresses = `${resolvedAddress.slice(0, 6)}...${resolvedAddress.slice(-4)}`;
  const displayName = resolvedEnsName || addyOrEns || croppedAddresses;

  return new ImageResponse(
    (
      <div tw="flex w-full h-full">
        <div tw="flex flex-col flex-grow">
          <div tw="flex max-h-[125px] font-bold bg-white p-4 pt-6 items-center flex-grow">
            <strong tw="text-6xl">address.vision</strong>
            <div tw="ml-12 text-4xl bg-blue-50 p-4 px-6 rounded-full border border-slate-300">{displayName}</div>
          </div>
          <div tw="flex bg-blue-50 flex-grow justify-between pt-6 pl-10">
            <div tw="flex flex-col">
              <div tw="flex">
                <div tw="bg-white text-4xl w-[600px] m-8 p-8 h-[400px] rounded-16 shadow-2xl flex items-center">
                  <img src={avatarUrl} width="200" height="200" tw="rounded-full" style={{ borderRadius: "128px" }} />
                  <div tw="flex flex-col ml-8">
                    <strong>{displayName}</strong>
                    <span tw="mt-2">Balance: {Number(balance).toFixed(4)} ETH</span>
                  </div>
                </div>
                <div tw="bg-white text-4xl m-8 ml-10 p-8 h-[400px] rounded-16 shadow-2xl flex items-center justify-between">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=330x330&data=${resolvedAddress}`}
                    width="330"
                    height="330"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "cache-control": "max-age=86400",
      },
    },
  );
}
