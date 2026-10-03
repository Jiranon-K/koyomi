"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

import { Curtain } from "@/components/motion/unveil";

import { SIGN_UP_PATH } from "./paths";

const SIGN_IN_POSTER = "/images/sign-in-poster.jpg";
const SIGN_UP_POSTER = "/images/sign-up-poster.webp";

export function BrandPoster() {
  const poster = usePathname() === SIGN_UP_PATH ? SIGN_UP_POSTER : SIGN_IN_POSTER;

  return (
    <Curtain key={poster} className="absolute inset-0 -z-10">
      <Image
        src={poster}
        alt=""
        fill
        sizes="(min-width: 1024px) 50vw, 1px"
        className="scale-110 object-cover blur-sm"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-scrim via-scrim/60 to-scrim/45"
      />
    </Curtain>
  );
}
