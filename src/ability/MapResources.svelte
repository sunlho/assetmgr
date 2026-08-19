<script lang="ts">
</script>

<div
  id="maps-panel"
  class="content map-content"
  role="tabpanel"
  aria-labelledby="maps-tab"
  aria-label="地图资源"
>
  <div class="map-empty">
    <div class="map-graphic" aria-hidden="true">
      <span></span><span></span><span></span><span></span><span></span
      ><span></span><span></span><span></span><span></span>
    </div>
    <p class="map-kicker">Map workspace</p>
    <h2>地图资源工作区</h2>
    <p>地图资源管理功能正在准备中，这里将用于浏览、校验与预览地图数据。</p>
    <span class="map-badge">即将推出</span>
  </div>
</div>

<style>
  .map-content {
    display: grid;
    place-items: center;
    background-image: radial-gradient(#d5d0c5 0.75px, transparent 0.75px);
    background-size: 15px 15px;
  }

  .map-empty {
    display: flex;
    width: min(100%, 480px);
    flex-direction: column;
    align-items: center;
    padding: 38px;
    text-align: center;
  }

  .map-graphic {
    display: grid;
    grid-template-columns: repeat(3, 18px);
    gap: 4px;
    margin-bottom: 24px;
    padding: 16px;
    border-radius: 15px;
    background: var(--nav);
    box-shadow: 0 12px 30px rgba(23, 32, 29, 0.18);
    transform: rotate(-2deg);
  }

  .map-graphic span {
    width: 18px;
    height: 18px;
    border-radius: 3px;
    background: #344039;
  }

  .map-graphic span:nth-child(2),
  .map-graphic span:nth-child(5),
  .map-graphic span:nth-child(6),
  .map-graphic span:nth-child(8) {
    background: var(--accent);
  }

  .map-kicker {
    margin: 0 0 8px;
    color: var(--accent-strong);
    font-size: 9px;
    font-weight: 750;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    color: var(--ink);
    font-size: 22px;
    letter-spacing: -0.03em;
  }

  .map-empty > p:not(.map-kicker) {
    max-width: 380px;
    margin: 12px 0 18px;
    color: var(--ink-soft);
    font-size: 13px;
    line-height: 1.7;
  }

  .map-badge {
    border: 1px solid #efc6b2;
    border-radius: 999px;
    padding: 6px 10px;
    color: var(--accent-strong);
    background: var(--accent-soft);
    font-size: 10px;
    font-weight: 650;
  }
</style>
