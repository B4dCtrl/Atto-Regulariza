// src/lib/api/mail-imagens.test.ts
import { describe, it, expect } from "vitest";
import {
  enderecoPermitido,
  enderecosResolvidosPermitidos,
  filtrarPorFamilia,
  urlPermitida,
  tipoPelaAssinatura,
} from "./mail-imagens.server";

describe("enderecoPermitido — IPv4", () => {
  it.each([
    ["0.0.0.0", "0/8"],
    ["0.1.2.3", "0/8"],
    ["10.0.0.1", "10/8"],
    ["10.255.255.255", "10/8"],
    ["100.64.0.1", "100.64/10"],
    ["100.127.255.254", "100.64/10"],
    ["127.0.0.1", "127/8"],
    ["127.1.2.3", "127/8"],
    ["169.254.169.254", "169.254/16 (metadados de nuvem)"],
    ["172.16.0.1", "172.16/12"],
    ["172.31.255.255", "172.16/12"],
    ["192.0.0.1", "192.0.0/24"],
    ["192.168.0.1", "192.168/16"],
    ["192.168.255.255", "192.168/16"],
    ["198.18.0.1", "198.18/15"],
    ["198.19.255.255", "198.18/15"],
    ["224.0.0.1", "multicast"],
    ["239.255.255.250", "multicast"],
    ["240.0.0.1", "reservado"],
    ["255.255.255.255", "broadcast"],
    ["192.0.2.1", "documentação"],
    ["198.51.100.1", "documentação"],
    ["203.0.113.1", "documentação"],
  ])("recusa %s (%s)", (ip) => {
    expect(enderecoPermitido(ip)).toBe(false);
  });

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "142.250.79.46",
    "100.63.255.255",
    "100.128.0.1",
    "172.15.255.255",
    "172.32.0.1",
    "198.17.255.255",
    "198.20.0.1",
    "223.255.255.254",
    "192.0.1.1",
    "192.169.0.1",
  ])("permite público %s", (ip) => {
    expect(enderecoPermitido(ip)).toBe(true);
  });

  it("recusa o que não é IP", () => {
    expect(enderecoPermitido("exemplo.com")).toBe(false);
    expect(enderecoPermitido("")).toBe(false);
    expect(enderecoPermitido("256.1.1.1")).toBe(false);
  });
});

describe("enderecoPermitido — IPv6", () => {
  it.each([
    ["::", "não especificado"],
    ["::1", "loopback"],
    ["0:0:0:0:0:0:0:1", "loopback por extenso"],
    ["fc00::1", "ULA fc00::/7"],
    ["fd12:3456:789a::1", "ULA fc00::/7"],
    ["fe80::1", "link-local"],
    ["febf::1", "link-local (fim de fe80::/10)"],
    ["fe80::1%eth0", "link-local com zona"],
    ["ff02::1", "multicast"],
    ["::ffff:127.0.0.1", "IPv4 mapeado privado"],
    ["::ffff:7f00:1", "IPv4 mapeado privado em hexa"],
    ["::ffff:10.0.0.1", "IPv4 mapeado privado"],
    ["::ffff:169.254.169.254", "IPv4 mapeado metadados"],
    ["0:0:0:0:0:ffff:192.168.1.1", "IPv4 mapeado por extenso"],
    ["64:ff9b::127.0.0.1", "NAT64 com IPv4 privado"],
    ["64:ff9b::a00:1", "NAT64 com IPv4 privado em hexa"],
    ["::127.0.0.1", "IPv4-compatível (obsoleto)"],
    ["2002:7f00:1::", "6to4 com IPv4 privado"],
    ["2001:db8::1", "documentação"],
    ["2001::1", "Teredo"],
    ["100::1", "descarte"],
  ])("recusa %s (%s)", (ip) => {
    expect(enderecoPermitido(ip)).toBe(false);
  });

  it.each([
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
    "::ffff:8.8.8.8",
    "64:ff9b::808:808",
    "2002:808:808::1",
  ])("permite público %s", (ip) => {
    expect(enderecoPermitido(ip)).toBe(true);
  });
});

describe("enderecosResolvidosPermitidos", () => {
  it("recusa se QUALQUER endereço devolvido for interno", () => {
    expect(
      enderecosResolvidosPermitidos([
        { address: "8.8.8.8", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ]),
    ).toBe(false);
  });

  it("recusa lista vazia", () => {
    expect(enderecosResolvidosPermitidos([])).toBe(false);
  });

  it("permite só públicos", () => {
    expect(
      enderecosResolvidosPermitidos([
        { address: "8.8.8.8", family: 4 },
        { address: "2001:4860:4860::8888", family: 6 },
      ]),
    ).toBe(true);
  });
});

describe("urlPermitida", () => {
  it.each([
    "https://loja.com.br/banner.png",
    "http://cdn.exemplo.com/a.gif?x=1",
    "https://loja.com:443/a.png",
    "http://loja.com:80/a.png",
    "https://8.8.8.8/a.png",
    "https://[2001:4860:4860::8888]/a.png",
  ])("permite %s", (u) => {
    expect(urlPermitida(u)).not.toBeNull();
  });

  it.each([
    ["ftp://loja.com/a.png", "esquema"],
    ["file:///etc/passwd", "esquema"],
    ["data:image/png;base64,AA==", "esquema"],
    ["javascript:alert(1)", "esquema"],
    ["https://loja.com:8443/a.png", "porta fora do padrão"],
    ["http://loja.com:443/a.png", "porta trocada"],
    ["https://loja.com:80/a.png", "porta trocada"],
    ["http://127.0.0.1/a.png", "IP literal de loopback"],
    ["http://169.254.169.254/latest/meta-data", "metadados"],
    ["http://[::1]/a.png", "IPv6 literal de loopback"],
    ["http://[::ffff:127.0.0.1]/a.png", "IPv6 mapeado"],
    ["http://2130706433/a.png", "IPv4 em decimal"],
    ["http://0x7f.0.0.1/a.png", "IPv4 em hexa"],
    ["http://0177.0.0.1/a.png", "IPv4 em octal"],
    ["http://127.1/a.png", "IPv4 abreviado"],
    ["http://localhost/a.png", "localhost"],
    ["http://LOCALHOST./a.png", "localhost com ponto final"],
    ["http://api.localhost/a.png", "subdomínio de localhost"],
    ["http://metadata.google.internal/a.png", "metadados do Google"],
    ["http://servico.internal/a.png", ".internal"],
    ["http://impressora.local/a.png", ".local"],
    ["http://intranet/a.png", "nome sem ponto"],
    ["https://usuario:senha@loja.com/a.png", "credencial na URL"],
    ["não é url", "lixo"],
  ])("recusa %s (%s)", (u) => {
    expect(urlPermitida(u)).toBeNull();
  });
});

describe("tipoPelaAssinatura", () => {
  const b = (...xs: number[]) => Buffer.from(xs);
  it("reconhece PNG, JPEG, GIF e WEBP", () => {
    expect(tipoPelaAssinatura(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(
      "image/png",
    );
    expect(tipoPelaAssinatura(b(0xff, 0xd8, 0xff, 0xe0, 0))).toBe("image/jpeg");
    expect(tipoPelaAssinatura(Buffer.from("GIF89a...."))).toBe("image/gif");
    expect(tipoPelaAssinatura(Buffer.from("GIF87a...."))).toBe("image/gif");
    expect(tipoPelaAssinatura(Buffer.from("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });

  it("recusa SVG, HTML e o resto", () => {
    expect(tipoPelaAssinatura(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(tipoPelaAssinatura(Buffer.from("<!doctype html><p>oi"))).toBeNull();
    expect(tipoPelaAssinatura(Buffer.from("RIFF\0\0\0\0WAVEfmt "))).toBeNull();
    expect(tipoPelaAssinatura(Buffer.alloc(0))).toBeNull();
  });
});

describe("filtrarPorFamilia", () => {
  const lista = [
    { address: "8.8.8.8", family: 4 },
    { address: "2001:4860:4860::8888", family: 6 },
  ];
  it("sem família (ou 0) devolve todos", () => {
    expect(filtrarPorFamilia(lista)).toEqual(lista);
    expect(filtrarPorFamilia(lista, 0)).toEqual(lista);
  });
  it("filtra por 4/6 numérico ou por nome", () => {
    expect(filtrarPorFamilia(lista, 4)).toEqual([lista[0]]);
    expect(filtrarPorFamilia(lista, "IPv6")).toEqual([lista[1]]);
  });
  it("família sem endereço devolve vazio", () => {
    expect(filtrarPorFamilia([lista[0]], 6)).toEqual([]);
  });
});
