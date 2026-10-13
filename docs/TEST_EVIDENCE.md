# Test evidence

Provider mode: **mock** (synthetic data, re-run with PROVIDER_MODE=live for real evidence)
Match threshold: 40 (below this a video is flagged low match). Generated: 2026-10-13T08:15:11.103Z

| Product | Instagram (new / strong) | Meta ads (new / strong) | TikTok | Duplicates removed | Visual check | Warnings |
|---|---|---|---|---|---|---|
| oversized graphic tee | 23 / 19 | 23 / 20 | - | 4 | 46 compared | none |
| protein dark chocolate | 23 / 16 | 23 / 20 | - | 4 | 46 compared | none |
| hydro steel water bottle | 23 / 20 | 22 / 17 | - | 5 | 45 compared | none |
| blue yoga mat | 22 / 19 | 23 / 21 | - | 5 | 45 compared | none |
| red running shoes | 23 / 17 | 23 / 18 | - | 4 | 46 compared | none |

## Repeat search (uniqueness)

Product: **oversized graphic tee**. First search returned 46 videos; searching again returned 45 videos, of which **0** had been shown before. Per source now: instagram 22, meta_ads 23.

## Examples of good and bad matches

### oversized graphic tee
- GOOD 90 (instagram): Honest review of oversized graphic tee in real life #oversized #tee
  - why: Visual 94/100: Sample mode: simulated visual match (looks like the product). Caption has 3 of 3 product keywor
- GOOD 88 (instagram): Honest review of oversized graphic tee in real life #oversized #tee
  - why: Visual 94/100: Sample mode: simulated visual match (looks like the product). Caption has 3 of 3 product keywor
- GOOD 88 (instagram): Unboxing oversized graphic tee - worth it? #oversized #tee
  - why: Visual 94/100: Sample mode: simulated visual match (looks like the product). Caption has 3 of 3 product keywor
- BAD 13 (meta_ads): my cat does a flip
  - why: Visual 13/100: Sample mode: simulated visual match (no product visible). Caption has 0 of 3 product keywords.
- BAD 11 (instagram): easy pasta recipe
  - why: Visual 11/100: Sample mode: simulated visual match (no product visible). Caption has 0 of 3 product keywords.
- BAD 10 (meta_ads): easy pasta recipe
  - why: Visual 8/100: Sample mode: simulated visual match (no product visible). Caption has 0 of 3 product keywords.
- note: Instagram Reels: 19 of 23 are strong matches (score 40+), the rest are flagged low match.
- note: Meta Ad Library: 20 of 23 are strong matches (score 40+), the rest are flagged low match.
- note: Sample mode: visual scores are simulated.

### protein dark chocolate
- GOOD 88 (instagram): Honest review of protein dark chocolate in real life #protein #chocolate
  - why: Visual 94/100: Sample mode: simulated visual match (looks like the product). Caption has 3 of 3 product keywor
- GOOD 87 (instagram): Honest review of protein dark chocolate - worth it? #protein #chocolate
  - why: Visual 92/100: Sample mode: simulated visual match (looks like the product). Caption has 3 of 3 product keywor
- GOOD 87 (instagram): Honest review of protein dark chocolate in real life #protein #chocolate
  - why: Visual 93/100: Sample mode: simulated visual match (looks like the product). Caption has 3 of 3 product keywor
- BAD 9 (instagram): gym motivation monday
  - why: Visual 2/100: Sample mode: simulated visual match (no product visible). Caption has 0 of 3 product keywords.
- BAD 8 (meta_ads): travel diaries day 3
  - why: Visual 2/100: Sample mode: simulated visual match (no product visible). Caption has 0 of 3 product keywords.
- BAD 7 (instagram): easy pasta recipe
  - why: Visual 0/100: Sample mode: simulated visual match (no product visible). Caption has 0 of 3 product keywords.
- note: Instagram Reels: 16 of 23 are strong matches (score 40+), the rest are flagged low match.
- note: Meta Ad Library: 20 of 23 are strong matches (score 40+), the rest are flagged low match.
- note: Sample mode: visual scores are simulated.

### hydro steel water bottle
- GOOD 89 (instagram): Unboxing hydro steel water bottle in real life #hydro #bottle
  - why: Visual 92/100: Sample mode: simulated visual match (looks like the product). Caption has 4 of 4 product keywor
- GOOD 88 (meta_ads): Honest review of hydro steel water bottle - worth it? #hydro #bottle
  - why: Visual 93/100: Sample mode: simulated visual match (looks like the product). Caption has 4 of 4 product keywor
- GOOD 88 (meta_ads): Honest review of hydro steel water bottle - worth it? #hydro #bottle
  - why: Visual 94/100: Sample mode: simulated visual match (looks like the product). Caption has 4 of 4 product keywor
- BAD 12 (meta_ads): easy pasta recipe
  - why: Visual 9/100: Sample mode: simulated visual match (no product visible). Caption has 0 of 4 product keywords.
- BAD 9 (instagram): my cat does a flip
  - why: Visual 2/100: Sample mode: simulated visual match (no product visible). Caption has 0 of 4 product keywords.
- BAD 9 (instagram): gym motivation monday
  - why: Visual 3/100: Sample mode: simulated visual match (no product visible). Caption has 0 of 4 product keywords.
- note: Instagram Reels: 20 of 23 are strong matches (score 40+), the rest are flagged low match.
- note: Meta Ad Library: 17 of 22 are strong matches (score 40+), the rest are flagged low match.
- note: Sample mode: visual scores are simulated.

### blue yoga mat
- GOOD 88 (instagram): Honest review of blue yoga mat - worth it? #blue #mat
  - why: Visual 95/100: Sample mode: simulated visual match (looks like the product). Caption has 3 of 3 product keywor
- GOOD 87 (instagram): Unboxing blue yoga mat - worth it? #blue #mat
  - why: Visual 90/100: Sample mode: simulated visual match (looks like the product). Caption has 3 of 3 product keywor
- GOOD 87 (instagram): Unboxing blue yoga mat in real life #blue #mat
  - why: Visual 93/100: Sample mode: simulated visual match (looks like the product). Caption has 3 of 3 product keywor
- BAD 14 (meta_ads): easy pasta recipe
  - why: Visual 14/100: Sample mode: simulated visual match (no product visible). Caption has 0 of 3 product keywords.
- BAD 12 (instagram): morning routine vlog
  - why: Visual 10/100: Sample mode: simulated visual match (no product visible). Caption has 0 of 3 product keywords.
- BAD 12 (meta_ads): easy pasta recipe
  - why: Visual 9/100: Sample mode: simulated visual match (no product visible). Caption has 0 of 3 product keywords.
- note: Instagram Reels: 19 of 22 are strong matches (score 40+), the rest are flagged low match.
- note: Meta Ad Library: 21 of 23 are strong matches (score 40+), the rest are flagged low match.
- note: Sample mode: visual scores are simulated.

### red running shoes
- GOOD 87 (instagram): Unboxing red running shoes in real life #red #shoes
  - why: Visual 95/100: Sample mode: simulated visual match (looks like the product). Caption has 3 of 3 product keywor
- GOOD 87 (instagram): Honest review of red running shoes in real life #red #shoes
  - why: Visual 94/100: Sample mode: simulated visual match (looks like the product). Caption has 3 of 3 product keywor
- GOOD 86 (meta_ads): Unboxing red running shoes in real life #red #shoes
  - why: Visual 93/100: Sample mode: simulated visual match (looks like the product). Caption has 3 of 3 product keywor
- BAD 9 (meta_ads): easy pasta recipe
  - why: Visual 6/100: Sample mode: simulated visual match (no product visible). Caption has 0 of 3 product keywords.
- BAD 9 (meta_ads): morning routine vlog
  - why: Visual 3/100: Sample mode: simulated visual match (no product visible). Caption has 0 of 3 product keywords.
- BAD 7 (instagram): morning routine vlog
  - why: Visual 3/100: Sample mode: simulated visual match (no product visible). Caption has 0 of 3 product keywords.
- note: Instagram Reels: 17 of 23 are strong matches (score 40+), the rest are flagged low match.
- note: Meta Ad Library: 18 of 23 are strong matches (score 40+), the rest are flagged low match.
- note: Sample mode: visual scores are simulated.
