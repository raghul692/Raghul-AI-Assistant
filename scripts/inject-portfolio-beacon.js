import dns from 'dns';
import { setGlobalDispatcher, Agent } from 'undici';
import { integrationManager } from '../services/integrationManager.js';

try {
  dns.setDefaultResultOrder('ipv4first');
  setGlobalDispatcher(new Agent({
    connect: { timeout: 15000, autoSelectFamily: false },
    allowH2: false
  }));
} catch (_) {}

async function main() {
  console.log('[BeaconInjector] Fetching index.html from raghul692/raghulraja_portfolio...');
  const file = await integrationManager.getGitHubFileContent({ path: 'index.html', branch: 'main' });

  if (file.content.includes('RAGHUL AI — Real-Time First-Party Visitor')) {
    console.log('[BeaconInjector] Beacon script is already present in index.html!');
    return;
  }

  const beaconScript = `
    <!-- ================================================================= -->
    <!-- RAGHUL AI — Real-Time First-Party Visitor & Traffic Intelligence Beacon -->
    <!-- ================================================================= -->
    <script>
      (function() {
        try {
          var SUPABASE_URL = "https://brmafvpjvdgieelcgivi.supabase.co";
          var SUPABASE_ANON = "sb_publishable_5o8G1FNXcDTa3tMdZUcPpg_awOWk_iU";

          var sid = sessionStorage.getItem("raghul_os_sid");
          if (!sid) {
            sid = "sess_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
            sessionStorage.setItem("raghul_os_sid", sid);
          }

          function getMetadata() {
            var tz = "UTC";
            try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch(e){}
            var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            return {
              timezone: tz,
              device: isMobile ? "Mobile" : "Desktop",
              screen: window.innerWidth + "x" + window.innerHeight,
              language: navigator.language || "en",
              platform: navigator.platform || "unknown"
            };
          }

          function recordEvent(eventType, path, target) {
            var payload = {
              page_path: path || window.location.pathname + window.location.hash || "/",
              referrer: document.referrer || "direct",
              session_id: sid,
              event_name: eventType || "pageview",
              user_agent: (navigator.userAgent || "browser").slice(0, 200),
              event_data: Object.assign(getMetadata(), {
                target: target || "",
                timestamp: Date.now()
              })
            };

            var jsonStr = JSON.stringify(payload);

            if (navigator.sendBeacon) {
              var blob = new Blob([jsonStr], { type: "application/json" });
              navigator.sendBeacon(SUPABASE_URL + "/rest/v1/visitor_analytics", blob);
            } else {
              fetch(SUPABASE_URL + "/rest/v1/visitor_analytics", {
                method: "POST",
                headers: {
                  "apikey": SUPABASE_ANON,
                  "Authorization": "Bearer " + SUPABASE_ANON,
                  "Content-Type": "application/json",
                  "Prefer": "return=minimal"
                },
                body: jsonStr,
                keepalive: true
              }).catch(function(){});
            }
          }

          if (document.readyState === "complete") {
            recordEvent("pageview");
          } else {
            window.addEventListener("load", function() { recordEvent("pageview"); });
          }

          window.addEventListener("hashchange", function() {
            recordEvent("pageview", window.location.pathname + window.location.hash);
          });

          document.addEventListener("click", function(e) {
            var el = e.target.closest("a, button");
            if (!el) return;
            var label = el.getAttribute("aria-label") || el.innerText || el.getAttribute("href") || "button";
            if (label && label.length < 60) {
              recordEvent("click", window.location.pathname + window.location.hash, label.trim());
            }
          }, { passive: true });
        } catch(err) {}
      })();
    </script>
`;

  const updatedContent = file.content.replace('</body>', beaconScript + '  </body>');
  console.log('[BeaconInjector] Injecting beacon snippet... Content length: ' + updatedContent.length);

  const commitRes = await integrationManager.commitGitHubFile({
    branch: 'main',
    path: 'index.html',
    content: updatedContent,
    message: 'feat(analytics): connect real-time first-party visitor telemetry beacon to Supabase'
  });

  console.log('[BeaconInjector] Successfully committed to GitHub!');
  console.log('[BeaconInjector] Commit SHA:', commitRes.commitSha);
}

main().catch(err => {
  console.error('[BeaconInjector] Execution failed:', err);
  process.exit(1);
});
