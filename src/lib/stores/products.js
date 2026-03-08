import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase/client';

export const products = writable([]);

export const loadProducts = async () => {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading products:', error);
        return;
    }

    products.set(data);
};

export const addProduct = async (productData) => {
    const { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select();

    if (error) {
        console.error('Error adding product:', error);
        return;
    }

    products.update(items => [...items, data[0]]);
    return data[0];
};

export const updateProduct = async (id, updates) => {
    const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select();

    if (error) {
        console.error('Error updating product:', error);
        return;
    }

    products.update(items => 
        items.map(item => item.id === id ? data[0] : item)
    );
};

export const deleteProduct = async (id) => {
    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting product:', error);
        return;
    }

    products.update(items => items.filter(item => item.id !== id));
};