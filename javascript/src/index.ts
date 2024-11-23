import { OBSWebSocket } from 'obs-websocket-js';
import * as dotenv from 'dotenv';

dotenv.config();

const OBS_HOST = process.env.OBS_HOST || 'localhost';
const OBS_PORT = process.env.OBS_PORT || '4455';
const OBS_PASSWORD = process.env.OBS_PASSWORD || '';
const obs = new OBSWebSocket();

const BACKGROUND_SOURCES = ['PalaceBackground1', 'PalaceBackground2']; // Two background sources in OBS
const VIDEO_PATHS = [
  process.env.DAYTIME_VIDEO_PATH || '',
  process.env.EVENING_VIDEO_PATH || '',
  process.env.NIGHTTIME_VIDEO_PATH || '',
  process.env.EVENING_VIDEO_PATH || '', // Reuse the evening video
];
let currentVideoIdx = 0;
let activeSourceIdx = 0; // Tracks which source is currently visible (0 or 1)

/**
 * Connect to OBS WebSocket server.
 */
async function connectToOBS() {
  try {
    await obs.connect(`ws://${OBS_HOST}:${OBS_PORT}`, OBS_PASSWORD);
    console.log('Connected to OBS');
  } catch (error) {
    console.error('Failed to connect to OBS:', error);
    throw error;
  }
}

/**
 * Update the input settings of a specific source.
 * @param {string} sourceName - The name of the source to update.
 * @param {string} videoPath - Path to the new video file.
 */
async function updateInputSettings(sourceName: string, videoPath: string) {
  try {
    await obs.call('SetInputSettings', {
      inputName: sourceName,
      inputSettings: {
        local_file: videoPath, // Correct property for file path
        looping: true, // Enable looping
        playback_speed: 1.0, // Default playback speed
      },
      overlay: true, // Preserve existing settings
    });
    console.log(`Updated video source ${sourceName} to ${videoPath}`);
  } catch (error) {
    console.error(`Error updating input settings for ${sourceName}:`, error);
  }
}

/**
 * Adjusts the opacity of a source using its Color Correction filter.
 * Keeps color multiply fixed at neutral (white) and adjusts only opacity.
 * @param {string} sourceName - The name of the source to adjust.
 * @param {number} opacity - Opacity value (0.0 to 1.0).
 */
async function setInputOpacity(sourceName: string, opacity: number) {
  try {
    // Cap opacity at a maximum of 1
    const cappedOpacity = Math.min(opacity, 1);

    await obs.call('SetSourceFilterSettings', {
      sourceName,
      filterName: 'Color Correction', // Ensure this matches the filter name in OBS
      filterSettings: {
        opacity: cappedOpacity * 1, // OBS expects opacity as a ratio (0.0 to 1.0)
      },
    });
    console.log(`Set opacity of ${sourceName} to ${cappedOpacity}`);
  } catch (error) {
    console.error(`Failed to set opacity for ${sourceName}:`, error);
  }
}

/**
 * Performs a crossfade transition between two background sources.
 */
async function crossfadeToNextVideo() {
  try {
    const fadeDuration = 10000; // Crossfade duration in milliseconds
    const steps = 1000; // Number of steps in the crossfade for smoother transitions
    const interval = fadeDuration / steps;

    const nextVideoIdx = (currentVideoIdx + 1) % VIDEO_PATHS.length;
    const nextVideoPath = VIDEO_PATHS[nextVideoIdx];
    const activeSource = BACKGROUND_SOURCES[activeSourceIdx];
    const nextSource = BACKGROUND_SOURCES[1 - activeSourceIdx]; // Alternate between 0 and 1

    // Load the next video into the next source
    await updateInputSettings(nextSource, nextVideoPath);
    await setInputOpacity(nextSource, 0); // Ensure the next source is fully transparent initially

    for (let i = 0; i <= steps; i++) {
      const opacityCurrent = 1 - i / steps; // Decrease opacity of current source
      const opacityNext = i / steps; // Increase opacity of next source

      await setInputOpacity(activeSource, opacityCurrent);
      await setInputOpacity(nextSource, opacityNext);

      await new Promise((resolve) => setTimeout(resolve, interval)); // Delay between steps
    }

    // Update the active source and current video index for the next cycle
    activeSourceIdx = 1 - activeSourceIdx; // Switch active source
    currentVideoIdx = nextVideoIdx;
  } catch (error) {
    console.error('Error during crossfade transition:', error);
  }
}

/**
 * Main entry point for the script.
 */
async function main() {
  await connectToOBS();

  // Initialize both sources
  await updateInputSettings(BACKGROUND_SOURCES[0], VIDEO_PATHS[currentVideoIdx]);
  await setInputOpacity(BACKGROUND_SOURCES[0], 1.0); // First source fully visible
  await setInputOpacity(BACKGROUND_SOURCES[1], 0.0); // Second source fully transparent

  // Crossfade through the videos every 30 seconds
  setInterval(crossfadeToNextVideo, 60000);
}

main().catch((error) => console.error('Unhandled error in main:', error));
