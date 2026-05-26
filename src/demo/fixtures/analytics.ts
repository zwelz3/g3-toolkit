/**
 * Graph Analytics Workbench fixture: academic citation network
 * with pre-computed metrics.
 */

import { UGM } from "@core/ugm";

export function buildAnalyticsUGM(): UGM {
  const ugm = new UGM();

  // Authors (15) with pre-computed metrics
  const authors = [
    {
      id: "auth:hinton",
      name: "Geoffrey Hinton",
      inst: "inst:toronto",
      pagerank: 0.142,
      betweenness: 0.38,
      community: 1,
    },
    {
      id: "auth:lecun",
      name: "Yann LeCun",
      inst: "inst:meta",
      pagerank: 0.128,
      betweenness: 0.32,
      community: 1,
    },
    {
      id: "auth:bengio",
      name: "Yoshua Bengio",
      inst: "inst:mila",
      pagerank: 0.115,
      betweenness: 0.29,
      community: 1,
    },
    {
      id: "auth:ng",
      name: "Andrew Ng",
      inst: "inst:stanford",
      pagerank: 0.098,
      betweenness: 0.24,
      community: 2,
    },
    {
      id: "auth:goodfellow",
      name: "Ian Goodfellow",
      inst: "inst:deepmind",
      pagerank: 0.089,
      betweenness: 0.21,
      community: 1,
    },
    {
      id: "auth:vaswani",
      name: "Ashish Vaswani",
      inst: "inst:google",
      pagerank: 0.082,
      betweenness: 0.18,
      community: 2,
    },
    {
      id: "auth:he",
      name: "Kaiming He",
      inst: "inst:meta",
      pagerank: 0.076,
      betweenness: 0.15,
      community: 3,
    },
    {
      id: "auth:silver",
      name: "David Silver",
      inst: "inst:deepmind",
      pagerank: 0.071,
      betweenness: 0.13,
      community: 2,
    },
    {
      id: "auth:radford",
      name: "Alec Radford",
      inst: "inst:openai",
      pagerank: 0.065,
      betweenness: 0.11,
      community: 2,
    },
    {
      id: "auth:devlin",
      name: "Jacob Devlin",
      inst: "inst:google",
      pagerank: 0.058,
      betweenness: 0.09,
      community: 2,
    },
    {
      id: "auth:ren",
      name: "Shaoqing Ren",
      inst: "inst:msra",
      pagerank: 0.052,
      betweenness: 0.07,
      community: 3,
    },
    {
      id: "auth:girshick",
      name: "Ross Girshick",
      inst: "inst:meta",
      pagerank: 0.048,
      betweenness: 0.06,
      community: 3,
    },
    {
      id: "auth:brown",
      name: "Tom Brown",
      inst: "inst:openai",
      pagerank: 0.044,
      betweenness: 0.05,
      community: 2,
    },
    {
      id: "auth:dosovitskiy",
      name: "Alexey Dosovitskiy",
      inst: "inst:google",
      pagerank: 0.039,
      betweenness: 0.04,
      community: 3,
    },
    {
      id: "auth:chen",
      name: "Ting Chen",
      inst: "inst:google",
      pagerank: 0.035,
      betweenness: 0.03,
      community: 3,
    },
  ];

  for (const a of authors) {
    ugm.addNode(a.id, {
      types: ["Author"],
      properties: {
        name: a.name,
        pagerank: a.pagerank,
        betweenness: a.betweenness,
        community: a.community,
      },
    });
  }

  // Papers (20) with citation counts
  const papers = [
    {
      id: "paper:attention",
      title: "Attention Is All You Need",
      year: 2017,
      citations: 95000,
      topic: "topic:nlp",
      conf: "conf:neurips",
      authors: ["auth:vaswani"],
    },
    {
      id: "paper:resnet",
      title: "Deep Residual Learning",
      year: 2016,
      citations: 180000,
      topic: "topic:cv",
      conf: "conf:cvpr",
      authors: ["auth:he", "auth:ren"],
    },
    {
      id: "paper:gan",
      title: "Generative Adversarial Networks",
      year: 2014,
      citations: 65000,
      topic: "topic:ml",
      conf: "conf:neurips",
      authors: ["auth:goodfellow"],
    },
    {
      id: "paper:bert",
      title: "BERT: Pre-training",
      year: 2018,
      citations: 85000,
      topic: "topic:nlp",
      conf: "conf:neurips",
      authors: ["auth:devlin"],
    },
    {
      id: "paper:gpt3",
      title: "Language Models are Few-Shot Learners",
      year: 2020,
      citations: 30000,
      topic: "topic:nlp",
      conf: "conf:neurips",
      authors: ["auth:brown", "auth:radford"],
    },
    {
      id: "paper:alphago",
      title: "Mastering the Game of Go",
      year: 2016,
      citations: 18000,
      topic: "topic:rl",
      conf: "conf:nature",
      authors: ["auth:silver"],
    },
    {
      id: "paper:dropout",
      title: "Dropout: A Simple Way",
      year: 2014,
      citations: 45000,
      topic: "topic:ml",
      conf: "conf:icml",
      authors: ["auth:hinton"],
    },
    {
      id: "paper:batchnorm",
      title: "Batch Normalization",
      year: 2015,
      citations: 50000,
      topic: "topic:ml",
      conf: "conf:icml",
      authors: ["auth:hinton"],
    },
    {
      id: "paper:adam",
      title: "Adam: A Method for Optimization",
      year: 2015,
      citations: 140000,
      topic: "topic:ml",
      conf: "conf:icml",
      authors: ["auth:bengio"],
    },
    {
      id: "paper:rcnn",
      title: "Rich Feature Hierarchies",
      year: 2014,
      citations: 28000,
      topic: "topic:cv",
      conf: "conf:cvpr",
      authors: ["auth:girshick"],
    },
    {
      id: "paper:yolo",
      title: "You Only Look Once",
      year: 2016,
      citations: 35000,
      topic: "topic:cv",
      conf: "conf:cvpr",
      authors: ["auth:girshick"],
    },
    {
      id: "paper:vit",
      title: "An Image is Worth 16x16 Words",
      year: 2021,
      citations: 22000,
      topic: "topic:cv",
      conf: "conf:icml",
      authors: ["auth:dosovitskiy"],
    },
    {
      id: "paper:simclr",
      title: "A Simple Framework for Contrastive Learning",
      year: 2020,
      citations: 15000,
      topic: "topic:ml",
      conf: "conf:icml",
      authors: ["auth:chen"],
    },
    {
      id: "paper:word2vec",
      title: "Efficient Estimation of Word Representations",
      year: 2013,
      citations: 40000,
      topic: "topic:nlp",
      conf: "conf:neurips",
      authors: ["auth:lecun"],
    },
    {
      id: "paper:lstm",
      title: "Long Short-Term Memory",
      year: 1997,
      citations: 72000,
      topic: "topic:ml",
      conf: "conf:neurips",
      authors: ["auth:bengio"],
    },
    {
      id: "paper:cnn",
      title: "Gradient-Based Learning",
      year: 1998,
      citations: 55000,
      topic: "topic:cv",
      conf: "conf:ieee",
      authors: ["auth:lecun"],
    },
    {
      id: "paper:dqn",
      title: "Playing Atari with Deep RL",
      year: 2015,
      citations: 20000,
      topic: "topic:rl",
      conf: "conf:nature",
      authors: ["auth:silver"],
    },
    {
      id: "paper:gpt2",
      title: "Language Models are Unsupervised",
      year: 2019,
      citations: 12000,
      topic: "topic:nlp",
      conf: "conf:openai",
      authors: ["auth:radford"],
    },
    {
      id: "paper:mobilenet",
      title: "MobileNets",
      year: 2017,
      citations: 18000,
      topic: "topic:cv",
      conf: "conf:cvpr",
      authors: ["auth:ng"],
    },
    {
      id: "paper:coursera",
      title: "Machine Learning on Coursera",
      year: 2012,
      citations: 5000,
      topic: "topic:ml",
      conf: "conf:other",
      authors: ["auth:ng"],
    },
  ];

  for (const p of papers) {
    ugm.addNode(p.id, {
      types: ["Paper"],
      properties: { name: p.title, year: p.year, citations: p.citations },
    });
  }

  // Institutions (5)
  const insts = [
    { id: "inst:toronto", name: "University of Toronto" },
    { id: "inst:meta", name: "Meta AI (FAIR)" },
    { id: "inst:mila", name: "Mila (Montreal)" },
    { id: "inst:stanford", name: "Stanford University" },
    { id: "inst:deepmind", name: "DeepMind" },
    { id: "inst:google", name: "Google Brain" },
    { id: "inst:openai", name: "OpenAI" },
    { id: "inst:msra", name: "Microsoft Research Asia" },
  ];

  for (const i of insts) {
    ugm.addNode(i.id, { types: ["Institution"], properties: { name: i.name } });
  }

  // Topics (6)
  const topics = [
    { id: "topic:ml", name: "Machine Learning" },
    { id: "topic:nlp", name: "Natural Language Processing" },
    { id: "topic:cv", name: "Computer Vision" },
    { id: "topic:rl", name: "Reinforcement Learning" },
  ];

  for (const t of topics) {
    ugm.addNode(t.id, { types: ["Topic"], properties: { name: t.name } });
  }

  // Conferences (5)
  const confs = [
    { id: "conf:neurips", name: "NeurIPS" },
    { id: "conf:icml", name: "ICML" },
    { id: "conf:cvpr", name: "CVPR" },
  ];

  for (const c of confs) {
    ugm.addNode(c.id, { types: ["Conference"], properties: { name: c.name } });
  }

  // ── Relationships ─────────────────────────────────────────────────

  // Author → affiliatedWith → Institution
  for (const a of authors) {
    ugm.addEdge(a.id, a.inst, { type: "affiliatedWith" });
  }

  // Paper → authored → Author + topic + conference
  for (const p of papers) {
    for (const authId of p.authors) {
      ugm.addEdge(authId, p.id, { type: "authored" });
    }
    if (ugm.hasNode(p.topic)) {
      ugm.addEdge(p.id, p.topic, { type: "topic" });
    }
    if (ugm.hasNode(p.conf)) {
      ugm.addEdge(p.id, p.conf, { type: "publishedAt" });
    }
  }

  // Citation edges (paper → cites → paper)
  ugm.addEdge("paper:gpt3", "paper:attention", { type: "cites" });
  ugm.addEdge("paper:gpt3", "paper:bert", { type: "cites" });
  ugm.addEdge("paper:gpt3", "paper:gpt2", { type: "cites" });
  ugm.addEdge("paper:bert", "paper:attention", { type: "cites" });
  ugm.addEdge("paper:vit", "paper:attention", { type: "cites" });
  ugm.addEdge("paper:vit", "paper:resnet", { type: "cites" });
  ugm.addEdge("paper:resnet", "paper:batchnorm", { type: "cites" });
  ugm.addEdge("paper:gan", "paper:dropout", { type: "cites" });
  ugm.addEdge("paper:dqn", "paper:dropout", { type: "cites" });
  ugm.addEdge("paper:simclr", "paper:resnet", { type: "cites" });
  ugm.addEdge("paper:yolo", "paper:rcnn", { type: "cites" });
  ugm.addEdge("paper:mobilenet", "paper:resnet", { type: "cites" });

  // Co-authorship
  ugm.addEdge("auth:hinton", "auth:lecun", { type: "collaboratesWith" });
  ugm.addEdge("auth:hinton", "auth:bengio", { type: "collaboratesWith" });
  ugm.addEdge("auth:lecun", "auth:bengio", { type: "collaboratesWith" });
  ugm.addEdge("auth:he", "auth:ren", { type: "collaboratesWith" });
  ugm.addEdge("auth:he", "auth:girshick", { type: "collaboratesWith" });
  ugm.addEdge("auth:brown", "auth:radford", { type: "collaboratesWith" });

  return ugm;
}
