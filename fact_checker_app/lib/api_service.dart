import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'models.dart'; // This imports the file we created in Step 2

class ApiService {
  // Use 10.0.2.2 for Android Emulator, localhost for iOS, or your PC IP for real device
  static const String baseUrl = 'http://10.0.2.2:5000/api'; 

  Future<VerificationResult> verifyClaim({String? claim, File? image}) async {
    var uri = Uri.parse('$baseUrl/verify-claim');
    var request = http.MultipartRequest('POST', uri);

    if (claim != null && claim.isNotEmpty) {
      request.fields['claim'] = claim;
    }

    if (image != null) {
      request.files.add(await http.MultipartFile.fromPath(
        'image',
        image.path,
      ));
    }

    try {
      var streamedResponse = await request.send();
      var response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        final jsonResponse = json.decode(response.body);
        return VerificationResult.fromJson(jsonResponse);
      } else {
        throw Exception('Failed to verify: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error connecting to server: $e');
    }
  }
}