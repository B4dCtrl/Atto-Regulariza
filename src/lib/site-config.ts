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

/** Chave de acesso dos desenvolvedores (use ?dev=ESTA_CHAVE na URL). */
export const DEV_ACCESS_KEY = "atto-dev-2026";
