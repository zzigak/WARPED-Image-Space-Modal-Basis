# read in json file and confirm if its successfully read

import json

def read_json(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)
    print('Successfully read in json file')
    return data


if __name__ == '__main__':
    file_path = 'modes_data_aug31_60fps_new.json'
    data = read_json(file_path)
    print(data)

