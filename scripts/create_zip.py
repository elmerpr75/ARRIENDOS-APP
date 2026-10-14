import os
import zipfile
import sys

def create_bundle_zip():
    exclude_dirs = {
        'node_modules', '.git', 'dist', '.aistudio', '__pycache__', '.vite', '.turbo'
    }
    exclude_files = {
        'app-codigo-actualizado.zip', '.DS_Store', 'npm-debug.log', 'yarn-error.log'
    }

    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    public_dir = os.path.join(base_dir, 'public')
    os.makedirs(public_dir, exist_ok=True)
    target_zip = os.path.join(public_dir, 'app-codigo-actualizado.zip')

    count = 0
    with zipfile.ZipFile(target_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(base_dir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]
            for file in files:
                if file in exclude_files or file.endswith('.pyc') or file.startswith('.env.local'):
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, base_dir)
                zipf.write(file_path, arcname)
                count += 1

    size_kb = round(os.path.getsize(target_zip) / 1024, 1)
    print(f"ZIP package created: {target_zip} ({count} files, {size_kb} KB)")

if __name__ == '__main__':
    create_bundle_zip()
