class VerificationResult {
  final String verdict;
  final int confidence;
  final Percentages percentages;
  final String explanation;
  final String summary;
  final List<Source> sources;
  final Metadata? metadata;

  VerificationResult({
    required this.verdict,
    required this.confidence,
    required this.percentages,
    required this.explanation,
    required this.summary,
    required this.sources,
    this.metadata,
  });

  factory VerificationResult.fromJson(Map<String, dynamic> json) {
    return VerificationResult(
      verdict: json['verdict'] ?? 'UNCERTAIN',
      confidence: json['confidence'] ?? 0,
      percentages: Percentages.fromJson(json['percentages'] ?? {}),
      explanation: json['explanation'] ?? '',
      summary: json['summary'] ?? '',
      sources: (json['sources'] as List?)
              ?.map((source) => Source.fromJson(source))
              .toList() ?? [],
      metadata: json['metadata'] != null ? Metadata.fromJson(json['metadata']) : null,
    );
  }
}

class Percentages {
  final int trueScore;
  final int falseScore;
  final int uncertainScore;

  Percentages({required this.trueScore, required this.falseScore, required this.uncertainScore});

  factory Percentages.fromJson(Map<String, dynamic> json) {
    return Percentages(
      trueScore: json['true'] ?? 0,
      falseScore: json['false'] ?? 0,
      uncertainScore: json['uncertain'] ?? 0,
    );
  }
}

class Source {
  final String name;
  final String type;
  final String? url;
  final String? excerpt;

  Source({required this.name, required this.type, this.url, this.excerpt});

  factory Source.fromJson(Map<String, dynamic> json) {
    return Source(
      name: json['name'] ?? 'Unknown Source',
      type: json['type'] ?? 'general',
      url: json['url'],
      excerpt: json['excerpt'],
    );
  }
}

class Metadata {
  final int totalSources;
  final dynamic processingTime;

  Metadata({required this.totalSources, this.processingTime});

  factory Metadata.fromJson(Map<String, dynamic> json) {
    return Metadata(
      totalSources: json['totalSources'] ?? 0,
      processingTime: json['processingTime'],
    );
  }
}