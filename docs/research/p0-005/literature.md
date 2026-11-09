# Published research relevant to personal-agent experiments

Focused primary-source survey, checked 10 November 2026 IST. These are existing methods and research results, not Twin achievements or evidence of a new invention. Institutional references do not imply collaboration or endorsement.

| Research area | Primary work | Reproduction constraint |
| --- | --- | --- |
| Generalized symbolic planning / MIT CSAIL | [Silver et al., Generalized Planning in PDDL Domains](https://arxiv.org/abs/2305.11014) | Compare with classical planners; distinguish program reuse from language understanding |
| Memory and reflection / Stanford | [Park et al., Generative Agents](https://arxiv.org/abs/2304.03442) | Believable simulation is not verified task execution |
| Pipeline optimization / Stanford and collaborators | [Khattab et al., DSPy](https://arxiv.org/abs/2310.03714) | Requires separate optimization/evaluation data and a model budget |
| Memory tiers / UC Berkeley | [Packer et al., MemGPT](https://arxiv.org/abs/2310.08560) | External memory management does not establish weight-level continual learning |
| Meta-learning / UC Berkeley | [Finn et al., MAML](https://proceedings.mlr.press/v70/finn17a.html) | Task-distribution training and disjoint evaluation are essential |
| Test-time adaptation / Berkeley researchers | [Wang et al., Tent](https://arxiv.org/abs/2006.10726) | Test-time parameter optimization changes the risk and compute model |
| Self-correction / Carnegie Mellon and collaborators | [Madaan et al., Self-Refine](https://arxiv.org/abs/2303.17651) | Model-generated critique is not independent verification |
| Cognitive architecture / Princeton | [Sumers et al., CoALA](https://arxiv.org/abs/2309.02427) | An organizing architecture is not an experimental proof of generality |
| Feedback memory / Princeton and collaborators | [Shinn et al., Reflexion](https://arxiv.org/abs/2303.11366) | Preserve the distinction between external feedback and self-report |
| World models / DeepMind and Toronto | [Hafner et al., Dreamer 3](https://www.nature.com/articles/s41586-025-08744-2) | Trained control environments differ from personal assistant workflows |
| Causal transfer / Mila researchers | [Bengio et al., A Meta-Transfer Objective](https://arxiv.org/abs/1901.10912) | Transfer assumptions need intervention/distribution-shift evidence |
| Graph reasoning / ETH Zurich | [Besta et al., Graph of Thoughts](https://arxiv.org/abs/2308.09687) | Added model calls must justify their cost against matched controls |
| Catastrophic forgetting / DeepMind | [Kirkpatrick et al., EWC](https://arxiv.org/abs/1612.00796) | Sequential training/forgetting curves; not equivalent to storing notes |
| Hierarchical reinforcement learning / DeepMind | [Vezhnevets et al., FeUdal Networks](https://arxiv.org/abs/1703.01161) | Training and environment interaction required |
| Multi-agent orchestration / Microsoft Research | [Wu et al., AutoGen](https://www.microsoft.com/en-us/research/publication/autogen-enabling-next-gen-llm-applications-via-multi-agent-conversation-framework/) | Compare with a single-agent system at equal budget |
| Retrieval-augmented generation | [Lewis et al., RAG](https://arxiv.org/abs/2005.11401) | Evidence retrieval and answer correctness require distinct measurement |
| Calibration | [Guo et al., On Calibration](https://arxiv.org/abs/1706.04599) | Confidence needs labeled calibration data; an assertion is not a probability estimate |

Framework availability and license checks should precede any integration. Notable inventory cautions observed in this audit: Letta's original repository now directs active development to `letta-ai/letta-code`; AutoGen's code MIT license is separate from its CC-BY documentation license; MiniGrid's license text states Apache-2.0 despite ambiguous API metadata; and GAIA's authoritative dataset is gated on Hugging Face, while the assumed `gaia-benchmark/GAIA` GitHub repository returned 404. No GAIA terms were accepted or data redistributed. Model weights and benchmark content may carry separate licenses from surrounding code.

No framework integration, patentability assessment or runtime recommendation is implied by inclusion in this reading list.
