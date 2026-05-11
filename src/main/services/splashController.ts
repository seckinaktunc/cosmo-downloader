let activeController: { continueWithoutUpdate: () => void } | null = null;

export function setActiveSplashController(
  controller: { continueWithoutUpdate: () => void } | null
): void {
  activeController = controller;
}

export function requestContinueWithoutUpdate(): void {
  activeController?.continueWithoutUpdate();
}
