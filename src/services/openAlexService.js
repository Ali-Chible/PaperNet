require('dotenv').config({ quiet: true });
const { parseAbstract } = require('../utils/parseAbstract');
const settingsService = require('./settingsService');

const BASE_URL = 'https://api.openalex.org/works';

function shortId(fullUrl) {
  return fullUrl ? fullUrl.replace('https://openalex.org/', '') : null;
}

async function request(url) {
  const apiKey = await settingsService.resolve('openalex_api_key', 'OPENALEX_API_KEY');
  url.searchParams.set('api_key', apiKey);

  const res = await fetch(url);
  if (!res.ok) {
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const detail = isJson ? await res.text() : res.statusText;
    const err = new Error(`OpenAlex request failed (${res.status}): ${detail}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function searchWorks(keyword, { perPage = 50, minYear = null, maxYear = null } = {}) {
  const url = new URL(BASE_URL);
  url.searchParams.set('search', keyword);
  url.searchParams.set('per_page', perPage);

  const yearFilter = buildYearFilter(minYear, maxYear);
  if (yearFilter) url.searchParams.set('filter', yearFilter);

  const data = await request(url);
  return data.results;
}

function buildYearFilter(minYear, maxYear) {
  if (minYear == null && maxYear == null) return null;
  const from = minYear ?? 1900;
  const to = maxYear ?? new Date().getFullYear() + 1;
  return `publication_year:${from}-${to}`;
}

async function getWorkById(openalexId) {
  const url = new URL(`${BASE_URL}/${openalexId}`);
  return request(url);
}

async function getCitingWorks(openalexId, { limit = 20 } = {}) {
  const url = new URL(BASE_URL);
  url.searchParams.set('filter', `cites:${openalexId}`);
  url.searchParams.set('per_page', limit);

  const data = await request(url);
  return data.results;
}

function parseWork(work) {
  return {
    openalexId: shortId(work.id),
    doi: work.doi || null,
    title: work.title,
    abstract: parseAbstract(work.abstract_inverted_index),
    publicationYear: work.publication_year,
    venue: work.primary_location?.source?.display_name || null,
    citedByCount: work.cited_by_count,
    referencedWorkIds: (work.referenced_works || []).map(shortId),
    authors: (work.authorships || []).map((a, index) => ({
      openalexAuthorId: shortId(a.author?.id),
      displayName: a.author?.display_name,
      position: index + 1,
    })),
  };
}

module.exports = { searchWorks, getWorkById, getCitingWorks, parseWork };