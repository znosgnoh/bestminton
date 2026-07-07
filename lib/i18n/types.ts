import type en from "./messages/en";

export type Locale = "vi" | "en" | "zh";

type DeepStringRecord<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringRecord<T[K]>;
};

export type Messages = DeepStringRecord<typeof en>;

type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}.${P}`
    : never
  : never;

type Path<T> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? Join<K, Path<T[K]>>
  : K;
}[keyof T & string];

export type MessageKey = Path<Messages>;

export interface LocaleOption {
  code: Locale;
  label: string;
  flag: string;
  htmlLang: string;
}
