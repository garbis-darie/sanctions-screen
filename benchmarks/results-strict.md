# sanctions-screen benchmark

Corpus: `/Users/bw/Documents/CV/gd-portfolio-github/sanctions-screen/benchmarks/corpus.json`
Threshold: `0.8`

- Total cases: **10**
- True positives: **8**
- False positives: **0**
- True negatives: **2**
- False negatives: **0**
- Precision: **1**
- Recall: **1**
- Accuracy: **1**

| Query | Expected | Predicted | Expected Entry | Top Entry | Top Score | Pass |
|---|---:|---:|---|---|---:|---:|
| Viktor Bout | true | true | OFAC-12345 | OFAC-12345 | 1 | true |
| Victor But | true | true | OFAC-12345 | OFAC-12345 | 1 | true |
| Tornado.cash | true | true | OFAC-11111 | OFAC-11111 | 1 | true |
| Garantex | true | true | EU-2022-001 | EU-2022-001 | 1 | true |
| HIDDEN COBRA | true | true | OFAC-22222 | OFAC-22222 | 1 | true |
| Lazarous Grup | true | true | OFAC-22222 | OFAC-22222 | 0.846 | true |
| Acme Payments Ltd | false | false | - | - | - | true |
| John Smith | false | false | - | - | - | true |
| Hydra Marketplace | true | true | OFAC-67890 | OFAC-67890 | 1 | true |
| Al Qaida | true | true | UN-6908 | UN-6908 | 1 | true |
