<template>
  <section
    class="weather-widget"
    :class="[
      weatherTheme,
      {
        'is-loading': loading,
        'is-stale': stale,
      },
    ]"
  >
    <div class="weather-decoration">
      <span></span>
      <span></span>
    </div>

    <header class="weather-header">
      <button
        type="button"
        class="weather-location"
        title="更换天气城市"
        @click="toggleLocationPanel"
      >
        <i class="bi-geo-alt"></i>
        <span>{{ location.name }}</span>
        <i class="bi-chevron-down"></i>
      </button>

      <button
        type="button"
        class="weather-refresh"
        :disabled="loading"
        title="刷新天气"
        aria-label="刷新天气"
        @click="refreshWeather"
      >
        <i
          class="bi-arrow-clockwise"
          :class="{ spinning: loading }"
        ></i>
      </button>
    </header>

    <div
      v-if="locationPanelVisible"
      class="weather-location-panel"
    >
      <div class="weather-search-row">
        <i class="bi-search"></i>

        <input
          ref="locationSearch"
          v-model.trim="searchKeyword"
          type="search"
          maxlength="80"
          placeholder="搜索城市，例如：上海"
          aria-label="搜索天气城市"
          @input="scheduleSearch"
          @keydown.esc.stop.prevent="closeLocationPanel"
        />

        <button
          v-if="searchKeyword"
          type="button"
          aria-label="清空城市搜索"
          @click="clearSearch"
        >
          ×
        </button>
      </div>

      <button
        type="button"
        class="current-location-action"
        :disabled="locating"
        @click="useCurrentLocation"
      >
        <i
          :class="
            locating
              ? 'bi-arrow-repeat spinning'
              : 'bi-crosshair'
          "
        ></i>

        <span>
          <strong>
            {{
              locating
                ? "正在获取位置…"
                : "使用当前位置"
            }}
          </strong>
          <small>
            仅在本机使用，不进行后台位置跟踪
          </small>
        </span>
      </button>

      <div
        v-if="searching"
        class="weather-search-status"
      >
        正在搜索城市…
      </div>

      <div
        v-else-if="searchError"
        class="weather-search-status is-error"
      >
        {{ searchError }}
      </div>

      <div
        v-else-if="
          searchKeyword.length >= 2 &&
          !searchResults.length
        "
        class="weather-search-status"
      >
        没有找到匹配的城市
      </div>

      <div
        v-if="searchResults.length"
        class="weather-search-results"
      >
        <button
          v-for="result in searchResults"
          :key="result.id"
          type="button"
          @click="selectLocation(result)"
        >
          <i class="bi-geo-alt"></i>

          <span>
            <strong>{{ result.name }}</strong>
            <small>
              {{
                [
                  result.admin1,
                  result.country,
                ]
                  .filter(Boolean)
                  .join(" · ")
              }}
            </small>
          </span>
        </button>
      </div>
    </div>

    <template v-if="weather">
      <div class="weather-current">
        <div class="weather-temperature">
          <i :class="weatherIcon(weather.code)"></i>

          <div>
            <strong>
              {{ Math.round(weather.temperature) }}°
            </strong>
            <span>{{ weatherText(weather.code) }}</span>
          </div>
        </div>

        <div class="weather-summary">
          <span>
            体感
            {{ Math.round(weather.apparentTemperature) }}°
          </span>

          <small>
            {{ weatherAdvice }}
          </small>
        </div>
      </div>

      <div class="weather-metrics">
        <div title="相对湿度">
          <i class="bi-droplet"></i>
          <span>{{ weather.humidity }}%</span>
        </div>

        <div title="风速">
          <i class="bi-wind"></i>
          <span>
            {{ Math.round(weather.windSpeed) }} km/h
          </span>
        </div>

        <div title="今日最高降水概率">
          <i class="bi-umbrella"></i>
          <span>
            {{ weather.precipitationProbability }}%
          </span>
        </div>
      </div>

      <div class="weather-forecast">
        <div
          v-for="item in forecast"
          :key="item.date"
          class="forecast-day"
        >
          <span>{{ item.label }}</span>
          <i :class="weatherIcon(item.code)"></i>
          <strong>
            {{ Math.round(item.maximum) }}°
            <small>
              / {{ Math.round(item.minimum) }}°
            </small>
          </strong>
        </div>
      </div>

      <footer class="weather-footer">
        <span v-if="stale">
          离线数据 · {{ updatedLabel }}
        </span>
        <span v-else>
          更新于 {{ updatedLabel }}
        </span>

        <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noreferrer"
        >
          Open-Meteo
        </a>
      </footer>
    </template>

    <div
      v-else-if="loading"
      class="weather-state"
    >
      <i class="bi-cloud-sun"></i>
      <span>正在获取天气…</span>
    </div>

    <div
      v-else
      class="weather-state is-error"
    >
      <i class="bi-cloud-slash"></i>
      <span>{{ errorMessage }}</span>

      <button
        type="button"
        @click="refreshWeather"
      >
        重新加载
      </button>
    </div>
  </section>
</template>

<script>
import moment from "moment";

/* CALENDAR_WEATHER_SYSTEM_20260907_V1 */

const LOCATION_KEY = "calendarWeatherLocation";
const CACHE_KEY = "calendarWeatherCache";
const CACHE_DURATION = 30 * 60 * 1000;

const DEFAULT_LOCATION = {
  name: "北京",
  latitude: 39.9042,
  longitude: 116.4074,
  timezone: "Asia/Shanghai",
};

const WEATHER_CODES = {
  0: {
    text: "晴朗",
    icon: "bi-sun",
    theme: "weather-clear",
  },
  1: {
    text: "大部晴朗",
    icon: "bi-sun",
    theme: "weather-clear",
  },
  2: {
    text: "局部多云",
    icon: "bi-cloud-sun",
    theme: "weather-cloud",
  },
  3: {
    text: "阴天",
    icon: "bi-clouds",
    theme: "weather-cloud",
  },
  45: {
    text: "有雾",
    icon: "bi-cloud-fog",
    theme: "weather-fog",
  },
  48: {
    text: "雾凇",
    icon: "bi-cloud-fog2",
    theme: "weather-fog",
  },
  51: {
    text: "小毛毛雨",
    icon: "bi-cloud-drizzle",
    theme: "weather-rain",
  },
  53: {
    text: "毛毛雨",
    icon: "bi-cloud-drizzle",
    theme: "weather-rain",
  },
  55: {
    text: "较强毛毛雨",
    icon: "bi-cloud-drizzle",
    theme: "weather-rain",
  },
  61: {
    text: "小雨",
    icon: "bi-cloud-rain",
    theme: "weather-rain",
  },
  63: {
    text: "中雨",
    icon: "bi-cloud-rain-heavy",
    theme: "weather-rain",
  },
  65: {
    text: "大雨",
    icon: "bi-cloud-rain-heavy",
    theme: "weather-rain",
  },
  71: {
    text: "小雪",
    icon: "bi-cloud-snow",
    theme: "weather-snow",
  },
  73: {
    text: "中雪",
    icon: "bi-cloud-snow",
    theme: "weather-snow",
  },
  75: {
    text: "大雪",
    icon: "bi-cloud-snow",
    theme: "weather-snow",
  },
  80: {
    text: "阵雨",
    icon: "bi-cloud-rain",
    theme: "weather-rain",
  },
  81: {
    text: "较强阵雨",
    icon: "bi-cloud-rain-heavy",
    theme: "weather-rain",
  },
  82: {
    text: "强阵雨",
    icon: "bi-cloud-rain-heavy",
    theme: "weather-rain",
  },
  95: {
    text: "雷暴",
    icon: "bi-cloud-lightning-rain",
    theme: "weather-storm",
  },
  96: {
    text: "雷暴伴冰雹",
    icon: "bi-cloud-lightning-rain",
    theme: "weather-storm",
  },
  99: {
    text: "强雷暴伴冰雹",
    icon: "bi-cloud-lightning-rain",
    theme: "weather-storm",
  },
};

export default {
  name: "WeatherWidget",

  data() {
    return {
      location: this.loadLocation(),
      weather: null,
      forecast: [],
      updatedAt: null,
      loading: false,
      locating: false,
      stale: false,
      errorMessage: "",
      locationPanelVisible: false,
      searchKeyword: "",
      searchResults: [],
      searching: false,
      searchError: "",
      searchTimer: null,
      refreshTimer: null,
      activeController: null,
    };
  },

  computed: {
    weatherTheme() {
      if (!this.weather) {
        return "weather-neutral";
      }

      return (
        WEATHER_CODES[this.weather.code]?.theme ||
        "weather-cloud"
      );
    },

    updatedLabel() {
      if (!this.updatedAt) return "刚刚";

      return moment(this.updatedAt).format("HH:mm");
    },

    weatherAdvice() {
      if (!this.weather) return "";

      const {
        code,
        apparentTemperature,
        windSpeed,
        precipitationProbability,
      } = this.weather;

      if (
        precipitationProbability >= 60 ||
        (code >= 51 && code <= 99)
      ) {
        return "外出记得带伞";
      }

      if (apparentTemperature <= 5) {
        return "天气偏冷，注意保暖";
      }

      if (apparentTemperature >= 30) {
        return "天气较热，注意补水";
      }

      if (windSpeed >= 30) {
        return "风力较强，注意出行";
      }

      return "适合安排今天的行动";
    },
  },

  mounted() {
    this.restoreCache();
    this.loadWeather();

    this.refreshTimer = window.setInterval(
      () => this.loadWeather(),
      CACHE_DURATION
    );

    document.addEventListener(
      "visibilitychange",
      this.onVisibilityChange
    );
  },

  beforeUnmount() {
    clearTimeout(this.searchTimer);
    clearInterval(this.refreshTimer);
    this.activeController?.abort();

    document.removeEventListener(
      "visibilitychange",
      this.onVisibilityChange
    );
  },

  methods: {
    loadLocation() {
      try {
        const stored = JSON.parse(
          localStorage.getItem(LOCATION_KEY) ||
            "null"
        );

        if (
          stored?.name &&
          Number.isFinite(stored.latitude) &&
          Number.isFinite(stored.longitude)
        ) {
          return stored;
        }
      } catch {
        // 使用默认城市。
      }

      return { ...DEFAULT_LOCATION };
    },

    saveLocation() {
      localStorage.setItem(
        LOCATION_KEY,
        JSON.stringify(this.location)
      );
    },

    restoreCache() {
      try {
        const cache = JSON.parse(
          localStorage.getItem(CACHE_KEY) ||
            "null"
        );

        if (
          !cache ||
          cache.locationKey !==
            this.locationCacheKey()
        ) {
          return;
        }

        this.weather = cache.weather || null;
        this.forecast = cache.forecast || [];
        this.updatedAt = cache.updatedAt || null;
        this.stale =
          Date.now() - Number(cache.updatedAt || 0) >
          CACHE_DURATION;
      } catch {
        // 缓存损坏时重新请求。
      }
    },

    saveCache() {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          locationKey: this.locationCacheKey(),
          weather: this.weather,
          forecast: this.forecast,
          updatedAt: this.updatedAt,
        })
      );
    },

    locationCacheKey() {
      return [
        Number(this.location.latitude).toFixed(2),
        Number(this.location.longitude).toFixed(2),
      ].join(",");
    },

    weatherMeta(code) {
      return (
        WEATHER_CODES[code] || {
          text: "天气变化",
          icon: "bi-cloud",
          theme: "weather-cloud",
        }
      );
    },

    weatherText(code) {
      return this.weatherMeta(code).text;
    },

    weatherIcon(code) {
      return `bi ${this.weatherMeta(code).icon}`;
    },

    async fetchJson(url, timeout = 12000) {
      this.activeController?.abort();

      const controller = new AbortController();
      this.activeController = controller;

      const timeoutId = setTimeout(
        () => controller.abort(),
        timeout
      );

      try {
        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `天气服务返回 ${response.status}`
          );
        }

        return await response.json();
      } finally {
        clearTimeout(timeoutId);

        if (this.activeController === controller) {
          this.activeController = null;
        }
      }
    },

    async loadWeather(force = false) {
      if (this.loading) return;

      if (!force) {
        try {
          const cache = JSON.parse(
            localStorage.getItem(CACHE_KEY) ||
              "null"
          );

          if (
            cache?.locationKey ===
              this.locationCacheKey() &&
            Date.now() -
              Number(cache.updatedAt || 0) <
              CACHE_DURATION
          ) {
            this.restoreCache();
            return;
          }
        } catch {
          // 继续请求。
        }
      }

      this.loading = true;
      this.errorMessage = "";

      const params = new URLSearchParams({
        latitude: String(this.location.latitude),
        longitude: String(this.location.longitude),
        current: [
          "temperature_2m",
          "apparent_temperature",
          "relative_humidity_2m",
          "weather_code",
          "wind_speed_10m",
          "is_day",
        ].join(","),
        daily: [
          "weather_code",
          "temperature_2m_max",
          "temperature_2m_min",
          "precipitation_probability_max",
        ].join(","),
        timezone:
          this.location.timezone || "auto",
        forecast_days: "3",
      });

      try {
        const data = await this.fetchJson(
          `https://api.open-meteo.com/v1/forecast?${params}`
        );

        const current = data.current || {};
        const daily = data.daily || {};

        this.weather = {
          temperature:
            current.temperature_2m ?? 0,
          apparentTemperature:
            current.apparent_temperature ?? 0,
          humidity:
            current.relative_humidity_2m ?? 0,
          code: current.weather_code ?? 0,
          windSpeed:
            current.wind_speed_10m ?? 0,
          isDay: current.is_day !== 0,
          precipitationProbability:
            daily
              .precipitation_probability_max?.[0] ??
            0,
        };

        this.forecast = (
          daily.time || []
        ).map((date, index) => ({
          date,
          label:
            index === 0
              ? "今天"
              : index === 1
                ? "明天"
                : moment(date).format("ddd"),
          code: daily.weather_code?.[index] ?? 0,
          maximum:
            daily.temperature_2m_max?.[index] ?? 0,
          minimum:
            daily.temperature_2m_min?.[index] ?? 0,
        }));

        this.updatedAt = Date.now();
        this.stale = false;
        this.saveCache();
      } catch (error) {
        console.warn("天气加载失败：", error);

        if (this.weather) {
          this.stale = true;
          this.errorMessage =
            "网络不可用，正在显示最近天气";
        } else {
          this.errorMessage =
            error?.name === "AbortError"
              ? "天气请求超时，请稍后重试"
              : "暂时无法获取天气";
        }
      } finally {
        this.loading = false;
      }
    },

    refreshWeather() {
      this.loadWeather(true);
    },

    toggleLocationPanel() {
      this.locationPanelVisible =
        !this.locationPanelVisible;

      if (this.locationPanelVisible) {
        this.$nextTick(() => {
          this.$refs.locationSearch?.focus();
        });
      }
    },

    closeLocationPanel() {
      this.locationPanelVisible = false;
      this.clearSearch();
    },

    clearSearch() {
      clearTimeout(this.searchTimer);
      this.searchKeyword = "";
      this.searchResults = [];
      this.searchError = "";
      this.searching = false;
    },

    scheduleSearch() {
      clearTimeout(this.searchTimer);
      this.searchResults = [];
      this.searchError = "";

      if (this.searchKeyword.length < 2) {
        this.searching = false;
        return;
      }

      this.searchTimer = setTimeout(
        () => this.searchLocations(),
        420
      );
    },

    async searchLocations() {
      const keyword = this.searchKeyword;

      if (keyword.length < 2) return;

      this.searching = true;
      this.searchError = "";

      try {
        const params = new URLSearchParams({
          name: keyword,
          count: "6",
          language: "zh",
          format: "json",
        });

        const data = await this.fetchJson(
          `https://geocoding-api.open-meteo.com/v1/search?${params}`
        );

        if (keyword !== this.searchKeyword) return;

        this.searchResults = data.results || [];
      } catch (error) {
        if (error?.name !== "AbortError") {
          this.searchError =
            "城市搜索失败，请检查网络";
        }
      } finally {
        this.searching = false;
      }
    },

    selectLocation(result) {
      this.location = {
        name: result.name,
        latitude: Number(result.latitude),
        longitude: Number(result.longitude),
        timezone: result.timezone || "auto",
        country: result.country || "",
        admin1: result.admin1 || "",
      };

      this.saveLocation();
      this.closeLocationPanel();
      this.weather = null;
      this.forecast = [];
      this.loadWeather(true);
    },

    useCurrentLocation() {
      if (!navigator.geolocation || this.locating) {
        this.searchError =
          "当前环境不支持位置服务";
        return;
      }

      this.locating = true;
      this.searchError = "";

      navigator.geolocation.getCurrentPosition(
        (position) => {
          /*
           * 保留约 1 公里级精度即可满足天气查询，
           * 减少本地保存的精确位置数据。
           */
          const latitude = Number(
            position.coords.latitude.toFixed(2)
          );
          const longitude = Number(
            position.coords.longitude.toFixed(2)
          );

          this.location = {
            name: "当前位置",
            latitude,
            longitude,
            timezone: "auto",
          };

          this.saveLocation();
          this.closeLocationPanel();
          this.locating = false;
          this.weather = null;
          this.forecast = [];
          this.loadWeather(true);
        },
        (error) => {
          this.locating = false;

          if (error.code === 1) {
            this.searchError =
              "位置权限未开启，可改为搜索城市";
          } else {
            this.searchError =
              "暂时无法获取当前位置";
          }
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 30 * 60 * 1000,
        }
      );
    },

    onVisibilityChange() {
      if (
        document.visibilityState === "visible"
      ) {
        this.loadWeather();
      }
    },
  },
};
</script>

<style scoped lang="scss">
.weather-widget {
  position: relative;
  min-height: 212px;
  flex: 0 0 auto;
  padding: 15px;
  overflow: hidden;
  border: 1px solid #e7ebf0;
  border-radius: 14px;
  background:
    linear-gradient(
      145deg,
      #f5f8ff,
      #eef4ff
    );
  color: #39414c;

  .dark-theme & {
    border-color: #303842;
    background:
      linear-gradient(
        145deg,
        #1c2531,
        #1a212a
      );
    color: #dde3ea;
  }

  &.weather-clear {
    background:
      linear-gradient(
        145deg,
        #fff8e8,
        #edf6ff
      );

    .dark-theme & {
      background:
        linear-gradient(
          145deg,
          #302a20,
          #192635
        );
    }
  }

  &.weather-rain,
  &.weather-storm {
    background:
      linear-gradient(
        145deg,
        #edf3fa,
        #e6eef5
      );

    .dark-theme & {
      background:
        linear-gradient(
          145deg,
          #1f2935,
          #18212b
        );
    }
  }
}

.weather-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;

  span {
    position: absolute;
    border-radius: 999px;
    background: rgba(91, 128, 188, 0.06);
  }

  span:first-child {
    width: 150px;
    height: 150px;
    top: -90px;
    right: -38px;
  }

  span:last-child {
    width: 72px;
    height: 72px;
    right: 32px;
    bottom: -42px;
  }
}

.weather-header,
.weather-current,
.weather-metrics,
.weather-forecast,
.weather-footer {
  position: relative;
  z-index: 2;
}

.weather-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.weather-location,
.weather-refresh {
  border: 0;
  background: transparent;
  cursor: pointer;
}

.weather-location {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
  padding: 0;
  color: inherit;
  font-size: 11px;
  font-weight: 600;

  span {
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bi-chevron-down {
    color: #9199a4;
    font-size: 8px;
  }
}

.weather-refresh {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 7px;
  color: #7f8996;

  &:hover {
    background: rgba(79, 96, 123, 0.08);
  }

  &:disabled {
    cursor: default;
  }
}

.weather-current {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 12px;
}

.weather-temperature {
  display: flex;
  align-items: center;
  gap: 10px;

  > i {
    color: #f4a62a;
    font-size: 32px;
  }

  > div {
    display: flex;
    flex-direction: column;
  }

  strong {
    font-size: 30px;
    font-weight: 580;
    line-height: 1;
  }

  span {
    margin-top: 4px;
    color: #707986;
    font-size: 10px;

    .dark-theme & {
      color: #aeb7c2;
    }
  }
}

.weather-summary {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: 5px;
  text-align: right;

  span {
    color: #737c88;
    font-size: 10px;

    .dark-theme & {
      color: #adb6c1;
    }
  }

  small {
    color: #4f6382;
    font-size: 9px;

    .dark-theme & {
      color: #91a8c7;
    }
  }
}

.weather-metrics {
  display: flex;
  gap: 6px;
  margin-top: 12px;

  div {
    display: inline-flex;
    min-width: 0;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 4px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.58);
    color: #6e7885;
    font-size: 8px;

    .dark-theme & {
      background: rgba(255, 255, 255, 0.05);
      color: #aeb7c2;
    }
  }
}

.weather-forecast {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
  margin-top: 10px;
}

.forecast-day {
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  gap: 3px 5px;
  padding: 6px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.38);

  .dark-theme & {
    background: rgba(255, 255, 255, 0.035);
  }

  span {
    color: #89919c;
    font-size: 8px;
  }

  > i {
    grid-row: 1 / 3;
    grid-column: 2;
    color: #7086a3;
    font-size: 13px;
  }

  strong {
    font-size: 9px;

    small {
      color: #939ba6;
      font-size: 8px;
      font-weight: 400;
    }
  }
}

.weather-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 9px;
  color: #a0a7b0;
  font-size: 7px;

  a {
    color: inherit;
    text-decoration: none;

    &:hover {
      color: #4263eb;
    }
  }
}

.weather-location-panel {
  position: absolute;
  z-index: 12;
  inset: 43px 10px 10px;
  padding: 10px;
  overflow-y: auto;
  border: 1px solid #e2e6eb;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 12px 35px rgba(31, 35, 41, 0.17);
  backdrop-filter: blur(12px);

  .dark-theme & {
    border-color: #3b444f;
    background: rgba(27, 33, 41, 0.98);
  }
}

.weather-search-row {
  display: flex;
  height: 32px;
  align-items: center;
  gap: 7px;
  padding: 0 9px;
  border: 1px solid #dfe4ea;
  border-radius: 8px;

  .dark-theme & {
    border-color: #3b444f;
  }

  > i {
    color: #9ba3ad;
    font-size: 11px;
  }

  input {
    min-width: 0;
    flex: 1;
    border: 0;
    outline: none;
    background: transparent;
    color: #3d434b;
    font: inherit;
    font-size: 10px;

    .dark-theme & {
      color: #dce1e7;
    }
  }

  button {
    border: 0;
    background: transparent;
    color: #989fa8;
  }
}

.current-location-action,
.weather-search-results button {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 9px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: #f3f5f8;
  }

  .dark-theme &:hover {
    background: #252c35;
  }
}

.current-location-action {
  margin-top: 7px;
  padding: 8px;

  > i {
    color: #4263eb;
  }

  span {
    display: flex;
    flex-direction: column;
  }

  strong {
    color: #4a515a;
    font-size: 10px;

    .dark-theme & {
      color: #d9dee4;
    }
  }

  small {
    margin-top: 2px;
    color: #a0a6af;
    font-size: 7px;
  }
}

.weather-search-results {
  margin-top: 5px;

  button {
    padding: 7px 8px;

    > i {
      color: #8490a0;
      font-size: 10px;
    }

    span {
      display: flex;
      min-width: 0;
      flex-direction: column;
    }

    strong {
      color: #4a515a;
      font-size: 10px;

      .dark-theme & {
        color: #d9dee4;
      }
    }

    small {
      margin-top: 2px;
      overflow: hidden;
      color: #a0a6af;
      font-size: 8px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.weather-search-status {
  padding: 12px 8px;
  color: #999fa8;
  font-size: 9px;
  text-align: center;

  &.is-error {
    color: #d26a6a;
  }
}

.weather-state {
  position: relative;
  z-index: 2;
  display: flex;
  min-height: 155px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: #8c95a0;
  font-size: 10px;

  > i {
    font-size: 27px;
  }

  button {
    border: 0;
    background: transparent;
    color: #4263eb;
    font-size: 10px;
    cursor: pointer;
  }
}

.spinning {
  display: inline-block;
  animation: weather-spin 0.85s linear infinite;
}

@keyframes weather-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
