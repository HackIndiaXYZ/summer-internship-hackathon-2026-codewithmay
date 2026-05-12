import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:url_launcher/url_launcher.dart';
// Make sure these files exist in your lib folder:
import 'api_service.dart'; 
import 'models.dart';

void main() {
  runApp(const FactCheckApp());
}

class FactCheckApp extends StatelessWidget {
  const FactCheckApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Fact Check AI',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.indigo,
        scaffoldBackgroundColor: const Color(0xFFF0F4F8),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _claimController = TextEditingController();
  final ApiService _apiService = ApiService(); // This requires api_service.dart
  File? _selectedImage;
  bool _isLoading = false;
  VerificationResult? _result;
  String? _errorMessage;

  // --- Actions ---

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);

    if (pickedFile != null) {
      setState(() {
        _selectedImage = File(pickedFile.path);
        _claimController.clear();
        _result = null;
      });
    }
  }

  Future<void> _handleVerify() async {
    if (_claimController.text.trim().isEmpty && _selectedImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter text or upload an image')),
      );
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _result = null;
    });

    try {
      final result = await _apiService.verifyClaim(
        claim: _claimController.text,
        image: _selectedImage,
      );
      setState(() {
        _result = result;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  // --- UI Helpers ---

  Color _getVerdictColor(String verdict) {
    switch (verdict) {
      case 'TRUE': return Colors.green.shade700;
      case 'FALSE': return Colors.red.shade700;
      case 'UNCERTAIN': return Colors.orange.shade800;
      default: return Colors.grey.shade700;
    }
  }

  Color _getVerdictBgColor(String verdict) {
    switch (verdict) {
      case 'TRUE': return Colors.green.shade50;
      case 'FALSE': return Colors.red.shade50;
      case 'UNCERTAIN': return Colors.orange.shade50;
      default: return Colors.grey.shade100;
    }
  }

  IconData _getVerdictIcon(String verdict) {
    switch (verdict) {
      case 'TRUE': return Icons.check_circle;
      case 'FALSE': return Icons.cancel;
      case 'UNCERTAIN': return Icons.help;
      default: return Icons.info;
    }
  }

  // --- Widget Build ---

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Fact Check AI', style: TextStyle(fontWeight: FontWeight.bold)),
        centerTitle: true,
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildHeader(),
            const SizedBox(height: 20),
            _buildInputSection(),
            const SizedBox(height: 20),
            if (_errorMessage != null) _buildErrorCard(),
            if (_isLoading) _buildLoading(),
            if (_result != null) _buildResultSection(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      children: [
        const Icon(Icons.shield_outlined, size: 48, color: Colors.indigo),
        const SizedBox(height: 8),
        const Text(
          "Advanced Fact-Checking",
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.black87),
        ),
        const SizedBox(height: 4),
        Text(
          "Powered by LLaMA 3.1 & Multi-source Evidence",
          style: TextStyle(fontSize: 14, color: Colors.grey[600]),
        ),
      ],
    );
  }

  Widget _buildInputSection() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(
              controller: _claimController,
              maxLines: 4,
              enabled: _selectedImage == null,
              decoration: InputDecoration(
                hintText: "Enter a claim (e.g. 'Coffee reduces diabetes risk')...",
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                filled: true,
                fillColor: _selectedImage == null ? Colors.white : Colors.grey[100],
              ),
            ),
            const SizedBox(height: 16),
            const Row(children: [
              Expanded(child: Divider()),
              Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Text("OR")),
              Expanded(child: Divider()),
            ]),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: _pickImage,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade300, style: BorderStyle.solid),
                  borderRadius: BorderRadius.circular(8),
                  color: _selectedImage != null ? Colors.indigo.shade50 : Colors.white,
                ),
                child: Column(
                  children: [
                    Icon(
                      _selectedImage != null ? Icons.check_circle : Icons.upload_file,
                      color: _selectedImage != null ? Colors.indigo : Colors.grey,
                      size: 30,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _selectedImage != null 
                        ? "Image Selected: ${_selectedImage!.path.split('/').last}" 
                        : "Upload Image for OCR",
                      style: TextStyle(
                        color: _selectedImage != null ? Colors.indigo : Colors.grey[600],
                        fontWeight: FontWeight.w500
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: _isLoading ? null : _handleVerify,
              icon: const Icon(Icons.search),
              label: const Text("Verify Claim"),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.indigo,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 50),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            )
          ],
        ),
      ),
    );
  }

  // --- FIXED LOADING WIDGET ---
  Widget _buildLoading() {
    // Removed 'padding' from Center. Using Padding widget instead.
    return const Padding(
      padding: EdgeInsets.all(20),
      child: Center(
        child: Column(
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 10),
            Text("Analyzing with LLaMA 3.1..."),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorCard() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.red.shade200),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline, color: Colors.red.shade700),
          const SizedBox(width: 10),
          Expanded(child: Text(_errorMessage!, style: TextStyle(color: Colors.red.shade900))),
        ],
      ),
    );
  }

  Widget _buildResultSection() {
    final r = _result!;
    return Column(
      children: [
        // 1. Verdict Card
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: _getVerdictBgColor(r.verdict),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _getVerdictColor(r.verdict).withOpacity(0.3)),
          ),
          child: Column(
            children: [
              Icon(_getVerdictIcon(r.verdict), size: 50, color: _getVerdictColor(r.verdict)),
              const SizedBox(height: 10),
              Text(
                r.verdict.replaceAll('_', ' '),
                style: TextStyle(
                  fontSize: 24, 
                  fontWeight: FontWeight.bold, 
                  color: _getVerdictColor(r.verdict)
                ),
              ),
              Text(
                "${r.confidence}% Confidence",
                style: TextStyle(color: _getVerdictColor(r.verdict).withOpacity(0.8)),
              ),
            ],
          ),
        ),
        
        const SizedBox(height: 16),
        
        // 2. Chart
        Card(
          color: Colors.white,
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                const Text("Confidence Distribution", style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 20),
                SizedBox(
                  height: 200,
                  child: PieChart(
                    PieChartData(
                      sectionsSpace: 2,
                      centerSpaceRadius: 40,
                      sections: [
                        if (r.percentages.trueScore > 0)
                          PieChartSectionData(
                            value: r.percentages.trueScore.toDouble(),
                            color: Colors.green,
                            title: '${r.percentages.trueScore}%',
                            titleStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          ),
                        if (r.percentages.falseScore > 0)
                          PieChartSectionData(
                            value: r.percentages.falseScore.toDouble(),
                            color: Colors.red,
                            title: '${r.percentages.falseScore}%',
                            titleStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          ),
                        if (r.percentages.uncertainScore > 0)
                          PieChartSectionData(
                            value: r.percentages.uncertainScore.toDouble(),
                            color: Colors.orange,
                            title: '${r.percentages.uncertainScore}%',
                            titleStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _LegendItem(color: Colors.green, text: "True"),
                    SizedBox(width: 10),
                    _LegendItem(color: Colors.red, text: "False"),
                    SizedBox(width: 10),
                    _LegendItem(color: Colors.orange, text: "Uncertain"),
                  ],
                )
              ],
            ),
          ),
        ),

        const SizedBox(height: 16),

        // 3. Explanation & Summary
        Card(
          color: Colors.white,
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(children: [
                  Icon(Icons.lightbulb_outline, color: Colors.indigo),
                  SizedBox(width: 8),
                  Text("Analysis", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                ]),
                const Divider(),
                const SizedBox(height: 8),
                const Text("Summary", style: TextStyle(fontWeight: FontWeight.bold)),
                Text(r.summary, style: TextStyle(color: Colors.grey[800])),
                const SizedBox(height: 16),
                const Text("Explanation", style: TextStyle(fontWeight: FontWeight.bold)),
                Text(r.explanation, style: TextStyle(color: Colors.grey[800])),
              ],
            ),
          ),
        ),

        const SizedBox(height: 16),

        // 4. Sources List
        if (r.sources.isNotEmpty)
          Card(
            color: Colors.white,
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("Sources", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 10),
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: r.sources.length,
                    separatorBuilder: (ctx, i) => const Divider(),
                    itemBuilder: (ctx, i) {
                      final source = r.sources[i];
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: _getSourceIcon(source.type),
                        title: Text(source.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (source.excerpt != null)
                              Text(source.excerpt!, maxLines: 2, overflow: TextOverflow.ellipsis),
                            if (source.url != null)
                              GestureDetector(
                                onTap: () => _launchUrl(source.url!),
                                child: Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Text("Read Source ->", style: TextStyle(color: Colors.indigo.shade600, fontSize: 12)),
                                ),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _getSourceIcon(String type) {
    if (type.contains('fact-check')) return const Icon(Icons.verified_user, color: Colors.indigo);
    if (type.contains('encyclopedia')) return const Icon(Icons.library_books, color: Colors.purple);
    if (type.contains('news')) return const Icon(Icons.newspaper, color: Colors.blue);
    return const Icon(Icons.public, color: Colors.grey);
  }

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

class _LegendItem extends StatelessWidget {
  final Color color;
  final String text;
  const _LegendItem({required this.color, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(width: 12, height: 12, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(text, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
}