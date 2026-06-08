/**
 * Flags da fase de pré-lançamento.
 *
 * - Site público mostra a página "Em construção".
 * - Devs acessam o site integral com ?dev=<DEV_ACCESS_KEY> (fica salvo no
 *   navegador). Para sair do modo dev: ?dev=off
 * - Login/auth pausados enquanto LOGIN_PAUSED = true.
 *
 * Quando for lançar de verdade: CONSTRUCTION_MODE = false e LOGIN_PAUSED = false.
 */
export const CONSTRUCTION_MODE = true;
export const LOGIN_PAUSED = true;

/** Chave de acesso da equipe (use ?dev=ESTA_CHAVE na URL ou o botão "Acesso da equipe"). */
export const DEV_ACCESS_KEY = "atto-dev-2026";

/** Chave do localStorage que marca o navegador como "modo equipe". */
export const DEV_STORAGE_KEY = "regulariza_dev_access";
