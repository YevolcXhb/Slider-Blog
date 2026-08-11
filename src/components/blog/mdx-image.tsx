import Image from "next/image";

export function MDXImage({ src, alt, width, height, ...props }: React.ComponentProps<"img">) {
  if (!src || typeof src !== "string") {
    // No usable src — render nothing rather than a broken image.
    return null;
  }

  // next.config.ts configures `images.remotePatterns` to allow all https
  // hostnames, so next/image handles both relative and absolute URLs.
  return (
    <Image
      src={src}
      alt={alt || ""}
      width={typeof width === "number" ? width : 800}
      height={typeof height === "number" ? height : 600}
      style={{ width: "100%", height: "auto" }}
      {...props}
    />
  );
}
