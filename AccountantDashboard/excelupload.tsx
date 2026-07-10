import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Button,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { pick } from '@react-native-documents/picker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ExcelUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [schoolCode, setSchoolCode] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchoolCode = async () => {
      try {
        const storedSchoolCode = await AsyncStorage.getItem('schoolCode');

        if (storedSchoolCode) {
          setSchoolCode(storedSchoolCode);
        } else {
          Alert.alert(
            'Error',
            'School code not found. Please login again.'
          );
        }
      } catch (error) {
        console.error('Failed to fetch school code:', error);
      }
    };

    fetchSchoolCode();
  }, []);

const uploadExcel = async () => {
  if (!schoolCode) {
    Alert.alert('Error', 'School code not available');
    return;
  }

  try {
    setIsUploading(true);

    const files = await pick({
      allowMultiSelection: false,
    });

    if (!files || files.length === 0) {
      setIsUploading(false);
      return;
    }

    const file = files[0];

    console.log('Selected File:', file);

    const formData = new FormData();

    formData.append('file', {
      uri: file.uri,
      name: file.name || 'excel.xlsx',
      type:
        file.type ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    } as any);

    formData.append('schoolCode', schoolCode);

    console.log('Uploading...');
    console.log('schoolCode:', schoolCode);
    console.log('file uri:', file.uri);
    console.log('file name:', file.name);
    console.log('file type:', file.type);

    const response = await axios.post(
      'http://162.215.210.38:3010/upload-excel-academics',
      formData,
      {
        timeout: 60000,
      }
    );

    console.log('Upload Response:', response.data);

    if (response.data.success) {
      Alert.alert('Success', 'Excel uploaded successfully');
    } else {
      Alert.alert(
        'Error',
        response.data.message || 'Upload failed'
      );
    }
  } catch (error: any) {
    console.log('====================');
    console.log('UPLOAD ERROR');
    console.log('message:', error?.message);
    console.log('code:', error?.code);
    console.log('response:', error?.response?.data);
    console.log('full error:', JSON.stringify(error, null, 2));
    console.log('====================');

    Alert.alert(
      'Upload Error',
      error?.response?.data?.message ||
      error?.message ||
      'Failed to upload file'
    );
  } finally {
    setIsUploading(false);
  }
};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Excel File</Text>

      {schoolCode ? (
        <Text style={styles.schoolCode}>
          School Code: {schoolCode}
        </Text>
      ) : (
        <Text style={styles.errorText}>
          School code not found
        </Text>
      )}

      <Button
        title="Select Excel File"
        onPress={uploadExcel}
        disabled={isUploading || !schoolCode}
      />

      {isUploading && (
        <ActivityIndicator
          size="large"
          style={styles.loader}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  schoolCode: {
    fontSize: 16,
    color: 'green',
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    marginBottom: 20,
  },
  loader: {
    marginTop: 20,
  },
});

export default ExcelUpload;