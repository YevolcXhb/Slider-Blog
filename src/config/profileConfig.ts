import type { ProfileConfig } from "@/types/profileConfig";

export const profileConfig: ProfileConfig = {
  avatar: "/slider/favicon/head.png",
  name: "Slider小汉堡",
  bio: "Hello，I'm Slider.",
  links: [
    {
      name: "GitHub",
      icon: "github",
      url: "https://github.com/YevolcXhb",
      showName: false,
    },
    {
      name: "Email",
      icon: "mail",
      url: "mailto:hello@example.com",
      showName: false,
    },
  ],
};
