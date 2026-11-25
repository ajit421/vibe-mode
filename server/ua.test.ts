import { describe, expect, it } from 'vitest';
import { classify } from './ua';

const UA = {
  chromeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  chromeIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  samsungTablet:
    'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Safari/537.36',
  operaMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0',
  chromebook:
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  headless:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36',
};

describe('classify', () => {
  it('tells the common browsers apart, even the ones that also say "Chrome" or "Safari"', () => {
    expect(classify(UA.chromeWindows)).toEqual({ browser: 'Chrome', os: 'Windows', device: 'desktop' });
    expect(classify(UA.edgeWindows)).toEqual({ browser: 'Edge', os: 'Windows', device: 'desktop' });
    expect(classify(UA.firefoxLinux)).toEqual({ browser: 'Firefox', os: 'Linux', device: 'desktop' });
    expect(classify(UA.safariMac)).toEqual({ browser: 'Safari', os: 'macOS', device: 'desktop' });
    expect(classify(UA.operaMac)).toEqual({ browser: 'Opera', os: 'macOS', device: 'desktop' });
    expect(classify(UA.chromebook)).toEqual({ browser: 'Chrome', os: 'ChromeOS', device: 'desktop' });
  });

  it('knows phones and tablets, and Android is not Linux', () => {
    expect(classify(UA.safariIphone)).toEqual({ browser: 'Safari', os: 'iOS', device: 'mobile' });
    expect(classify(UA.chromeIphone)).toEqual({ browser: 'Chrome', os: 'iOS', device: 'mobile' });
    expect(classify(UA.chromeAndroid)).toEqual({ browser: 'Chrome', os: 'Android', device: 'mobile' });
    expect(classify(UA.samsungTablet)).toEqual({ browser: 'Samsung Internet', os: 'Android', device: 'tablet' });
  });

  it('uses the page’s hints: Brave, and an iPad asking for the desktop site', () => {
    expect(classify(UA.chromeWindows, { brave: true }).browser).toBe('Brave');
    expect(classify(UA.firefoxLinux, { brave: true }).browser).toBe('Firefox'); // only Chrome can be Brave
    expect(classify(UA.safariMac, { touch: true })).toEqual({ browser: 'Safari', os: 'iOS', device: 'tablet' });
  });

  it('marks bots and empty headers, so they are left out of the counts', () => {
    expect(classify(UA.googlebot).device).toBe('bot');
    expect(classify(UA.headless).device).toBe('bot');
    expect(classify(null)).toEqual({ browser: 'Other', os: 'Other', device: 'bot' });
  });
});
