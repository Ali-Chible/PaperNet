function parseAbstract(invertedIndex) {
  if (!invertedIndex) return null;

  const positions = [];
  for (const [word, indices] of Object.entries(invertedIndex)) {
    for (const index of indices) {
      positions[index] = word;
    }
  }
  return positions.join(' ').trim();
}

module.exports = { parseAbstract };
