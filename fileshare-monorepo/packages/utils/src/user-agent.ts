/** 从 User-Agent 中提取浏览器与操作系统名称。 */
export function parseUserAgent(userAgent: string): { browser: string; os: string } {
  const ua = userAgent || '';
  let browser = '未知';
  const edge = ua.match(/Edg(?:e|A|iOS)?\/(\d+)/);
  const chrome = ua.match(/Chrome\/(\d+)/);
  const firefox = ua.match(/Firefox\/(\d+)/);
  const safari = ua.match(/Version\/(\d+)[\d.]*\s+(?:Mobile\/\S+\s+)?Safari\//);
  if (edge) {
    browser = `Edge ${edge[1]}`;
  } else if (chrome) {
    browser = `Chrome ${chrome[1]}`;
  } else if (firefox) {
    browser = `Firefox ${firefox[1]}`;
  } else if (safari) {
    browser = `Safari ${safari[1]}`;
  }

  let os = '未知';
  if (/Windows NT 10\.0/.test(ua)) {
    os = 'Windows 10/11';
  } else if (/Windows NT 6\.[123]/.test(ua)) {
    os = 'Windows 7/8';
  } else if (/Windows/.test(ua)) {
    os = 'Windows';
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    const version = ua.match(/OS (\d+)[._](\d+)/);
    os = version ? `iOS ${version[1]}.${version[2]}` : 'iOS';
  } else if (/Android/.test(ua)) {
    const version = ua.match(/Android (\d+)/);
    os = version ? `Android ${version[1]}` : 'Android';
  } else if (/Mac OS X/.test(ua)) {
    const version = ua.match(/Mac OS X (\d+)[._](\d+)/);
    os = version ? `macOS ${version[1]}.${version[2]}` : 'macOS';
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
  }

  return { browser, os };
}
