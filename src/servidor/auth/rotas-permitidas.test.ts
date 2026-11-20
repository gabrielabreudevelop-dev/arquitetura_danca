import { expect, it } from "vitest";
import { rotaAuthPermitida } from "./rotas-permitidas";

it.each([
  ["POST", "/sign-in/email"],
  ["POST", "/sign-out"],
  ["GET", "/get-session"],
])("permite %s %s", (metodo, caminho) =>
  expect(rotaAuthPermitida(metodo, caminho)).toBe(true));

it.each([
  ["POST", "/sign-up/email"],
  ["POST", "/forget-password"],
  ["GET", "/list-sessions"],
  ["GET", "/sign-in/email"],
  ["POST", "/sign-in/email/"],
])("bloqueia %s %s", (metodo, caminho) =>
  expect(rotaAuthPermitida(metodo, caminho)).toBe(false));
