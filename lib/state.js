let GENERATED_TIMETABLE = null;
let CANCELLATION_REQUESTS = [];
let SUBSTITUTION_OFFERS = [];

export function getState() { return { GENERATED_TIMETABLE, CANCELLATION_REQUESTS, SUBSTITUTION_OFFERS }; }
export function setGeneratedTimetable(tt) { GENERATED_TIMETABLE = tt; }
export function pushCancellation(req) { CANCELLATION_REQUESTS.push(req); }
export function replaceCancellationRequests(newArr) { CANCELLATION_REQUESTS = newArr; }
export function pushSubOffer(offer) { SUBSTITUTION_OFFERS.push(offer); }
export function replaceSubOffers(newArr) { SUBSTITUTION_OFFERS = newArr; }
