/* eslint-disable @next/next/no-img-element */
import { NextRequest } from "next/server";
import { ImageResponse } from "@vercel/og";
import { blo } from "blo";
import { Address, createPublicClient, formatEther, http, isAddress } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

export const config = {
  runtime: "edge",
};

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

async function resolveEnsToAddress(ensName: string): Promise<Address | null> {
  try {
    const address = await publicClient.getEnsAddress({
      name: normalize(ensName),
    });
    return address || null;
  } catch (error) {
    console.error("Error resolving ENS to address:", error);
    return null;
  }
}

async function resolveAddressToEns(address: Address): Promise<string | null> {
  try {
    const ensName = await publicClient.getEnsName({ address });
    return ensName || null;
  } catch (error) {
    console.error("Error resolving address to ENS:", error);
    return null;
  }
}

async function fetchBalance(address: Address): Promise<string | null> {
  try {
    const balance = await publicClient.getBalance({ address });
    return formatEther(balance);
  } catch (error) {
    console.error(`Error fetching balance for address ${address}:`, error);
    return null;
  }
}

export default async function handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    if (!searchParams.has("addyOrEns")) {
      return new Response("Missing 'addyOrEns' query parameter", { status: 400 });
    }

    const addyOrEns = searchParams.get("addyOrEns")?.slice(0, 100) || "blank";
    let resolvedAddress: Address | null = null;
    let resolvedEnsName: string | null = null;
    let balance: string | null = null;

    const paramAsAddress = isAddress(addyOrEns as string) ? addyOrEns : null;
    let paramAsEns = /\.(eth|xyz)$/.test(addyOrEns as string) ? addyOrEns : null;

    if (paramAsEns) {
      resolvedAddress = await resolveEnsToAddress(paramAsEns as string);
      if (!resolvedAddress) {
        return new Response("ENS name not found", { status: 404 });
      }
      balance = await fetchBalance(resolvedAddress);
    } else if (paramAsAddress) {
      resolvedAddress = paramAsAddress as Address;
      resolvedEnsName = await resolveAddressToEns(paramAsAddress as Address);
      paramAsEns = resolvedEnsName;
      balance = await fetchBalance(paramAsAddress as Address);
    }

    let avatarUrl;

    if (paramAsEns) {
      const avatarApiResponse = await fetch(`https://ensdata.net/media/avatar/${paramAsEns}`);
      if (avatarApiResponse.ok) {
        avatarUrl = `https://ensdata.net/media/avatar/${paramAsEns}`;
      } else {
        avatarUrl = blo(resolvedAddress as Address);
      }
    } else {
      avatarUrl = blo(resolvedAddress as Address);
    }

    const croppedAddresses = (resolvedAddress || "").slice(0, 6) + "..." + (resolvedAddress || "").slice(-4);
    const displayName = resolvedEnsName || paramAsEns || croppedAddresses;

    return new ImageResponse(
      (
        <div style={{ display: "flex" }} tw="w-full h-full">
          <div style={{ display: "flex" }} tw="flex-col flex-grow">
            <div style={{ display: "flex" }} tw="max-h-[125px] font-bold bg-white p-4 pt-6 items-center flex-grow">
              <strong tw="text-6xl">👀 address.vision</strong>
              <div tw="ml-12 text-4xl bg-blue-50 p-4 px-6 rounded-full border border-slate-300 ">{displayName}</div>
            </div>
            <div tw="flex bg-blue-50 flex-grow justify-between pt-6 pl-10">
              <div tw="flex flex-col">
                <div tw="flex">
                  <div tw="bg-white text-4xl m-8 p-8 h-[400px] rounded-16 shadow-2xl flex items-center justify-between ">
                    <img
                      src={avatarUrl}
                      width={200}
                      height={200}
                      tw="rounded-full"
                      style={{
                        objectFit: "cover",
                        height: `200px`,
                        width: `200px`,
                      }}
                      alt="ENS Avatar"
                    />
                    <div tw="flex flex-col ml-8">
                      <strong>{displayName}</strong>
                      <span tw="mt-2">Balance: {Number(balance).toFixed(4)} ETH</span>
                    </div>
                  </div>
                  <div tw="bg-white text-4xl m-8 ml-0 p-8 h-[400px] rounded-16 shadow-2xl flex items-center justify-between ">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=330x330&data=${
                        resolvedAddress || addyOrEns
                      }`}
                      width={330}
                      height={330}
                      alt="QR Code"
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
      },
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
