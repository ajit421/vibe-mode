/*
 * Google's "Sign in with Google" button (Google Identity Services), loaded
 * only when the Customize panel shows it — never on a normal page load, so
 * the site doesn't fetch Google's script for visitors who never sign in.
 *
 * The button is Google's own (an iframe it draws into our element): its
 * popup is what lets the visitor pick an account, and it hands back an ID
 * token that functions/api/google.ts checks. No client secret is involved.
 */

interface GoogleId {
  initialize(options: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    ux_mode?: 'popup' | 'redirect';
    use_fedcm_for_button?: boolean;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      logo_alignment?: 'left' | 'center';
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

const SCRIPT = 'https://accounts.google.com/gsi/client';
let loading: Promise<GoogleId> | null = null;

function loadGoogle(): Promise<GoogleId> {
  loading ??= new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => {
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error('Google sign-in didn’t load.'));
    };
    script.onerror = () => {
      // Drop the failed tag so the next try fetches it again.
      script.remove();
      loading = null;
      reject(new Error('Couldn’t reach Google.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Draws Google's button into `parent`. `onCredential` gets the ID token when
 * the visitor picks an account. Resolves false when Google can't be reached
 * (offline, blocked by an extension) so the caller can say so.
 */
export async function renderGoogleButton(
  parent: HTMLElement,
  clientId: string,
  onCredential: (credential: string) => void,
): Promise<boolean> {
  try {
    const id = await loadGoogle();
    // Called again on each render: the callback must be the current one.
    id.initialize({
      client_id: clientId,
      callback: ({ credential }) => credential && onCredential(credential),
      ux_mode: 'popup',
      use_fedcm_for_button: true,
      auto_select: false,
    });
    parent.replaceChildren();
    id.renderButton(parent, { type: 'standard', theme: 'filled_black', size: 'medium', text: 'continue_with', shape: 'pill' });
    return true;
  } catch {
    return false;
  }
}
