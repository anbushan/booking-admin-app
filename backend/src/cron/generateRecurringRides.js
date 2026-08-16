import { generateAllActiveRecurringRides } from "../lib/recurringRides.js";

// Runs on an interval from index.js. Keeps every active recurring
// series' rolling 14-day-ahead window of actual bookable Ride rows
// topped up — see lib/recurringRides.js for the generation rule itself
// (this file is just the periodic trigger, same "thin cron wrapper
// around a lib function" shape as expireStaleRides.js/checkNoShows.js).
// A new/resumed template also runs this same generation once,
// synchronously, right when that happens — this interval is the
// fallback that keeps the window topped up as today's date moves
// forward, not the only time generation ever runs.
export async function generateRecurringRides() {
  const { templatesProcessed, ridesCreated } = await generateAllActiveRecurringRides();
  if (ridesCreated > 0) {
    console.log(`Recurring rides: generated ${ridesCreated} ride(s) across ${templatesProcessed} active series.`);
  }
}
